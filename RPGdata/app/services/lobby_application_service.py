"""Черновик заявки на персонажа, открытый или заказанный из лобби."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app import models, scheme
from app.services.application_entity_service import create_player_character_for_application
from app.services.application_reviewer import require_master_reviewer
from app.services.bot_notify_service import schedule_application_requested


def _load_options():
    return (
        selectinload(models.CharacterApplication.reviewer),
        selectinload(models.CharacterApplication.reviews).selectinload(
            models.ApplicationReview.author
        ),
        selectinload(models.CharacterApplication.item_requests),
        selectinload(models.CharacterApplication.granted_items),
    )


def lobby_member_ids(lobby: scheme.Lobby) -> set[UUID]:
    ids: set[UUID] = set()
    if lobby.master is not None:
        ids.add(lobby.master.id)
    for user in list(lobby.users or []) + list(lobby.invited_users or []):
        ids.add(user.id)
    for player in lobby.players or []:
        if player.user is not None:
            ids.add(player.user.id)
    return ids


async def _load(db: AsyncSession, application_id: UUID) -> models.CharacterApplication:
    stmt = (
        select(models.CharacterApplication)
        .where(models.CharacterApplication.id == application_id)
        .options(*_load_options())
    )
    obj = (await db.execute(stmt)).scalars().first()
    if obj is None:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    return obj


async def open_lobby_character_application(
    db: AsyncSession,
    *,
    lobby: scheme.Lobby,
    actor: models.User,
    target_user_id: UUID | None,
    reviewer_id: UUID | None,
) -> models.CharacterApplication:
    rule_id = getattr(lobby.scenario, "rule_id_str", None) if lobby.scenario else None
    if not rule_id:
        raise HTTPException(status_code=400, detail="Сначала выберите сценарий")
    if actor.id not in lobby_member_ids(lobby):
        raise HTTPException(status_code=403, detail="Вы не в этом лобби")

    is_master = lobby.master is not None and lobby.master.id == actor.id
    player_id = target_user_id or actor.id
    if is_master:
        if player_id not in lobby_member_ids(lobby):
            raise HTTPException(status_code=400, detail="Этого игрока нет в лобби")
        chosen_reviewer = reviewer_id or actor.id
    else:
        if player_id != actor.id:
            raise HTTPException(
                status_code=403,
                detail="Заявку за другого игрока может заказать только мастер",
            )
        chosen_reviewer = reviewer_id or (lobby.master.id if lobby.master else None)

    chosen_reviewer = await require_master_reviewer(db, chosen_reviewer)

    existing = (
        await db.execute(
            select(models.CharacterApplication)
            .where(
                models.CharacterApplication.user_id == player_id,
                models.CharacterApplication.rule_id_str == rule_id,
                models.CharacterApplication.status == models.ApplicationStatus.draft,
            )
            .order_by(models.CharacterApplication.updated_at.desc())
        )
    ).scalars().first()

    if existing is None:
        existing = models.CharacterApplication(
            user_id=player_id,
            reviewer_id=chosen_reviewer,
            rule_id_str=rule_id,
            name="Новый персонаж",
            data={},
            status=models.ApplicationStatus.draft,
        )
        db.add(existing)
        await db.flush()
        await create_player_character_for_application(db, existing)
    elif chosen_reviewer and existing.reviewer_id != chosen_reviewer:
        existing.reviewer_id = chosen_reviewer
        existing.updated_at = datetime.now(timezone.utc)

    await db.commit()

    if is_master and player_id != actor.id:
        schedule_application_requested(
            user_id=player_id,
            application_id=existing.id,
            lobby_name=lobby.name,
            master_name=actor.full_name or actor.tg,
        )

    return await _load(db, existing.id)
