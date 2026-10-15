"""Очередь заранее нарисованных жестов и подстановка в ход.

Картинка забирается только если клиент прислал usePreparedSeed и текущая
стадия — бросок из реестра. Стадии настройки в реестре нет.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.prepared_seed import PreparedRollSeed
from app.models.user import Player
from app.services.scenario_entities.common import with_db

MAX_STOCK = 40
MAX_IMAGE_CHARS = 500_000
PNG_PREFIX = "data:image/png;base64,"

# Одна картинка в одно поле входа стадии.
SINGLE_SEED_FIELDS = {
    "perform_move.roll": "roll_seed",
    "common.free_dice_roll.roll": "roll_seed",
    "gumshoe.attack.roll": "canvas_seed",
    "gumshoe.attack.damage": "damage_seed",
    "gumshoe.contest.roll": "canvas_seed",
    "john.action.canvas": "canvas_seed",
    "initiative.tie_canvas": "canvas_seed",
}

SEED_STAGES = set(SINGLE_SEED_FIELDS) | {
    "perform_move.damage_roll",
    "gumshoe.terrify.roll",
    "initiative.roll",
}


class PreparedSeedError(ValueError):
    pass


def validate_seed_image(image: str) -> str:
    if not isinstance(image, str) or not image.startswith(PNG_PREFIX):
        raise PreparedSeedError("Жест должен быть PNG data-URL")
    if len(image) > MAX_IMAGE_CHARS:
        raise PreparedSeedError("Картинка жеста слишком большая")
    return image


def resolve_seed_stage(workflow: dict | None, data: dict | None) -> str | None:
    """Стадия, которой можно отдать жест. Клиентский _stageKey не перебивает сервер."""
    wf = workflow if isinstance(workflow, dict) else {}
    payload = data if isinstance(data, dict) else {}
    phase = str(wf.get("stageKey") or "")
    stage_data = wf.get("stageData") if isinstance(wf.get("stageData"), dict) else {}
    wizard = stage_data.get("wizard") if isinstance(stage_data.get("wizard"), dict) else {}
    current = str(wizard.get("currentKey") or "")
    requested = str(payload.get("_stageKey") or "")

    if phase in SEED_STAGES:
        return phase
    if current in SEED_STAGES and (not requested or requested == current):
        return current
    return None


def context_already_rolled(stage: str, workflow: dict | None) -> bool:
    wf = workflow if isinstance(workflow, dict) else {}
    ctx = wf.get("context") if isinstance(wf.get("context"), dict) else {}
    entry = ctx.get("entry") if isinstance(ctx.get("entry"), dict) else {}
    if stage == "perform_move.roll":
        roll = entry.get("roll") if isinstance(entry.get("roll"), dict) else {}
        dice = roll.get("dice") if isinstance(roll.get("dice"), list) else []
        return len(dice) >= 2
    if stage == "common.free_dice_roll.roll":
        roll = ctx.get("roll") if isinstance(ctx.get("roll"), dict) else {}
        dice = roll.get("dice") if isinstance(roll.get("dice"), list) else []
        return len(dice) > 0
    if stage == "gumshoe.attack.roll":
        dice = entry.get("dice") if isinstance(entry.get("dice"), list) else []
        return len(dice) > 0
    if stage == "gumshoe.attack.damage":
        rolls = entry.get("damage_rolls") if isinstance(entry.get("damage_rolls"), list) else []
        return len(rolls) > 0
    if stage == "john.action.canvas":
        results = entry.get("dice_results") if isinstance(entry.get("dice_results"), list) else []
        return len(results) > 0
    return False


def consume_plan(stage: str, data: dict) -> tuple[int, Callable[[list[str]], int]]:
    """Сколько пустых слотов закрыть и как записать полученные картинки."""
    if stage == "initiative.roll":
        if str(data.get("op") or "") != "roll":
            return 0, _unused
        return _one_field("roll_seed", data)

    if stage == "perform_move.damage_roll":
        rolls = data.get("rollsById")
        if not isinstance(rolls, dict):
            return 0, _unused
        keys = [
            key
            for key, item in rolls.items()
            if isinstance(item, dict) and item.get("committed") and not str(item.get("roll_seed") or "")
        ]

        def apply(images: list[str]) -> int:
            used = 0
            for key, image in zip(keys, images):
                rolls[key]["roll_seed"] = image
                used += 1
            return used

        return len(keys), apply

    if stage == "gumshoe.terrify.roll":
        seeds = data.get("seeds")
        if not isinstance(seeds, dict):
            return 0, _unused
        keys = [key for key, value in seeds.items() if not value]

        def apply_seeds(images: list[str]) -> int:
            used = 0
            for key, image in zip(keys, images):
                seeds[key] = image
                used += 1
            return used

        return len(keys), apply_seeds

    field = SINGLE_SEED_FIELDS.get(stage)
    if not field:
        return 0, _unused
    return _one_field(field, data)


def _unused(_images: list[str]) -> int:
    return 0


def _one_field(field: str, data: dict) -> tuple[int, Callable[[list[str]], int]]:
    if data.get(field):
        return 0, _unused

    def apply(images: list[str]) -> int:
        if not images:
            return 0
        data[field] = images[0]
        return 1

    return 1, apply


ClaimFn = Callable[[int], Awaitable[list[str]]]


async def fill_prepared_seeds(
    *,
    session_id: Any,
    user_id: Any,
    workflow: dict | None,
    input_data: dict,
    claim_fn: ClaimFn | None = None,
) -> list[str]:
    """Забирает жесты и пишет их во вход стадии. Возвращает забранные картинки.

    Флаг usePreparedSeed снимается всегда, даже если стадия запас не берёт.
    """
    if not isinstance(input_data, dict) or not input_data.pop("usePreparedSeed", False):
        return []

    stage = resolve_seed_stage(workflow, input_data)
    if stage is None or context_already_rolled(stage, workflow):
        return []

    needed, apply = consume_plan(stage, input_data)
    if needed <= 0:
        return []

    if claim_fn is not None:
        images = list(await claim_fn(needed))
    else:
        images = await claim_for_user(session_id, user_id, needed)
    if not images:
        return []

    try:
        used = apply(images)
    except Exception:
        if claim_fn is None:
            await restore_for_user(session_id, user_id, images)
        raise

    if used < len(images) and claim_fn is None:
        await restore_for_user(session_id, user_id, images[used:])
    return images[:used]


async def claim_for_user(session_id: Any, user_id: Any, count: int) -> list[str]:
    if count <= 0:
        return []

    async def _run(db: AsyncSession) -> list[str]:
        player_id = await _player_id(db, session_id, user_id)
        if player_id is None:
            return []
        images = await _claim(db, player_id, count)
        await db.commit()
        return images

    return await with_db(_run)


async def restore_for_user(session_id: Any, user_id: Any, images: list[str]) -> None:
    if not images:
        return

    async def _run(db: AsyncSession) -> None:
        player_id = await _player_id(db, session_id, user_id)
        if player_id is None:
            return
        await _restore(db, player_id, images)
        await db.commit()

    await with_db(_run)


async def list_seeds(db: AsyncSession, player_id: UUID) -> list[PreparedRollSeed]:
    rows = await db.execute(
        select(PreparedRollSeed)
        .where(PreparedRollSeed.player_id == player_id)
        .order_by(PreparedRollSeed.position.asc(), PreparedRollSeed.created_at.asc(), PreparedRollSeed.id.asc())
    )
    return list(rows.scalars().all())


async def append_seed(db: AsyncSession, player_id: UUID, image: str) -> PreparedRollSeed:
    image = validate_seed_image(image)
    existing = await list_seeds(db, player_id)
    if len(existing) >= MAX_STOCK:
        raise PreparedSeedError("В запасе уже максимум жестов")
    position = (existing[-1].position + 1) if existing else 0
    row = PreparedRollSeed(id=uuid4(), player_id=player_id, position=position, image=image)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def delete_seed(db: AsyncSession, player_id: UUID, seed_id: UUID) -> bool:
    row = await db.get(PreparedRollSeed, seed_id)
    if row is None or row.player_id != player_id:
        return False
    await db.delete(row)
    await db.commit()
    return True


async def reorder_seeds(db: AsyncSession, player_id: UUID, ids: list[UUID]) -> list[PreparedRollSeed]:
    rows = await list_seeds(db, player_id)
    by_id = {row.id: row for row in rows}
    if set(ids) != set(by_id) or len(ids) != len(by_id):
        raise PreparedSeedError("Список порядка должен содержать все жесты запаса")
    for index, seed_id in enumerate(ids):
        by_id[seed_id].position = index
    await db.commit()
    return await list_seeds(db, player_id)


async def player_id_for(db: AsyncSession, session_id: Any, user_id: Any) -> UUID | None:
    return await _player_id(db, session_id, user_id)


async def _player_id(db: AsyncSession, session_id: Any, user_id: Any) -> UUID | None:
    try:
        sid = session_id if isinstance(session_id, UUID) else UUID(str(session_id))
        uid = user_id if isinstance(user_id, UUID) else UUID(str(user_id))
    except (TypeError, ValueError):
        return None
    row = await db.execute(
        select(Player.id).where(Player.game_session_id == sid, Player.user_id == uid).limit(1)
    )
    return row.scalar_one_or_none()


async def _claim(db: AsyncSession, player_id: UUID, count: int) -> list[str]:
    rows = (
        await db.execute(
            select(PreparedRollSeed)
            .where(PreparedRollSeed.player_id == player_id)
            .order_by(PreparedRollSeed.position.asc(), PreparedRollSeed.created_at.asc(), PreparedRollSeed.id.asc())
            .limit(count)
            .with_for_update(skip_locked=True)
        )
    ).scalars().all()
    images = [row.image for row in rows]
    for row in rows:
        await db.delete(row)
    return images


async def _restore(db: AsyncSession, player_id: UUID, images: list[str]) -> None:
    rows = (
        await db.execute(
            select(PreparedRollSeed)
            .where(PreparedRollSeed.player_id == player_id)
            .order_by(PreparedRollSeed.position.asc())
        )
    ).scalars().all()
    for index, row in enumerate(rows):
        row.position = len(images) + index
    for index, image in enumerate(images):
        db.add(PreparedRollSeed(id=uuid4(), player_id=player_id, position=index, image=image))
