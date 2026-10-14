"""Строки хроники сценария: одна запись — одна строка со штампом."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models


def _format_game_time(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt.strftime("%Y-%m-%dT%H:%M:%S")

KIND_NOTE = "core:note"
KIND_NPC_CREATED = "core:npc_created"
KIND_SCENE_JOIN = "core:scene_join"
KIND_DW_XP = "plugin:dw:xp"


def has_list_filter(
    *,
    subject_id: UUID | str | None = None,
    kinds: list[str] | None = None,
    scene_id: UUID | str | None = None,
) -> bool:
    return bool(subject_id or kinds or scene_id)


def _fmt_clock(value: str | None) -> str:
    if not value:
        return ""
    text = str(value).replace("T", " ")
    if len(text) >= 16 and text[13] == ":":
        return text[:16]
    return text


def _join(parts: list[str]) -> str:
    return " · ".join(part for part in parts if part)


def render_chronicle_text(
    *,
    kind: str,
    text: str,
    subject_id: UUID | str | None,
    payload: dict | None,
    stamp: dict | None,
) -> str:
    stamp = stamp or {}
    clock = _fmt_clock(stamp.get("game_time"))
    scene_clock = _fmt_clock(stamp.get("scene_time"))
    location_id = stamp.get("location_id")
    location = f"[//location:{location_id}]" if location_id else ""
    prose = (text or "").strip()

    if kind == KIND_DW_XP:
        amount = int((payload or {}).get("amount") or 0)
        return _join([clock, location, f"+{amount} опыт", prose])
    if kind == KIND_NOTE:
        note = f"[//note:{subject_id}]" if subject_id else ""
        scene_bit = f"сцена {scene_clock}" if scene_clock else ""
        return _join([clock, scene_bit, location, note, prose])
    if kind == KIND_NPC_CREATED:
        return _join([clock, location, f"создан [//npc:{subject_id}]"])
    if kind == KIND_SCENE_JOIN:
        place = f"на {location}" if location else ""
        return _join([clock, f"[//npc:{subject_id}] в сцене", place])
    return _join([clock, location, prose])


def stamp_from_inner(inner, scene_id: UUID | str | None = None) -> dict[str, Any]:
    timeline = getattr(inner, "timeline", None)
    current = getattr(timeline, "current_time", None) if timeline else None
    if current is None:
        current = getattr(inner, "scenario_starts_at", None)
    scene = None
    if scene_id is not None:
        want = str(scene_id)
        for item in getattr(inner, "scenes", None) or []:
            if str(getattr(item, "id", "")) == want:
                scene = item
                break
    location_id = getattr(scene, "location_id", None) if scene is not None else None
    return {
        "game_time": _format_game_time(current),
        "scene_id": getattr(scene, "id", None) if scene is not None else None,
        "scene_time": getattr(scene, "datetime", None) if scene is not None else None,
        "location_id": location_id,
    }


def _as_uuid(value: UUID | str | None) -> UUID | None:
    if value is None or value == "":
        return None
    return value if isinstance(value, UUID) else UUID(str(value))


async def record_line(
    db: AsyncSession,
    scenario_id: UUID,
    *,
    kind: str,
    text: str = "",
    subject_kind: str | None = None,
    subject_id: UUID | str | None = None,
    payload: dict | None = None,
    author_user_id: UUID | str | None = None,
    stamp: dict | None = None,
    render: bool = False,
) -> models.ChronicleLine:
    stamp = stamp or {}
    stored = render_chronicle_text(
        kind=kind,
        text=text,
        subject_id=subject_id,
        payload=payload,
        stamp=stamp,
    ) if render else (text or "")
    row = models.ChronicleLine(
        scenario_id=scenario_id,
        kind=kind,
        text=stored,
        subject_kind=subject_kind,
        subject_id=_as_uuid(subject_id),
        real_at=datetime.now(timezone.utc),
        game_time=stamp.get("game_time"),
        scene_id=_as_uuid(stamp.get("scene_id")),
        scene_time=stamp.get("scene_time"),
        location_id=_as_uuid(stamp.get("location_id")),
        payload=payload or {},
        author_user_id=_as_uuid(author_user_id),
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def list_lines(
    db: AsyncSession,
    scenario_id: UUID,
    *,
    subject_id: UUID | str | None = None,
    kinds: list[str] | None = None,
    scene_id: UUID | str | None = None,
    allow_all: bool = False,
    limit: int = 200,
) -> list[models.ChronicleLine]:
    if not allow_all and not has_list_filter(subject_id=subject_id, kinds=kinds, scene_id=scene_id):
        return []
    stmt = select(models.ChronicleLine).where(models.ChronicleLine.scenario_id == scenario_id)
    if subject_id:
        stmt = stmt.where(models.ChronicleLine.subject_id == _as_uuid(subject_id))
    if scene_id:
        stmt = stmt.where(models.ChronicleLine.scene_id == _as_uuid(scene_id))
    if kinds:
        stmt = stmt.where(models.ChronicleLine.kind.in_(kinds))
    stmt = stmt.order_by(models.ChronicleLine.real_at.asc()).limit(limit)
    return list((await db.execute(stmt)).scalars().all())


async def update_line(
    db: AsyncSession,
    scenario_id: UUID,
    line_id: UUID,
    *,
    text: str | None = None,
    payload: dict | None = None,
) -> tuple[models.ChronicleLine | None, int]:
    """Returns the row and the XP delta applied to the subject character (0 if none)."""
    row = (
        await db.execute(
            select(models.ChronicleLine).where(
                models.ChronicleLine.id == line_id,
                models.ChronicleLine.scenario_id == scenario_id,
            )
        )
    ).scalars().first()
    if row is None:
        return None, 0
    if text is not None:
        row.text = text
    xp_delta = 0
    if payload is not None:
        old_amount = int((row.payload or {}).get("amount") or 0) if isinstance(row.payload, dict) else 0
        new_amount = int(payload.get("amount") or 0)
        row.payload = payload
        if row.kind == KIND_DW_XP and row.subject_kind == "character" and row.subject_id:
            xp_delta = new_amount - old_amount
    await db.commit()
    await db.refresh(row)
    return row, xp_delta


async def apply_xp_delta(
    db: AsyncSession,
    scenario_id: UUID,
    character_id: UUID,
    delta: int,
) -> None:
    """Сдвигает опыт в живой сессии, если она есть, и пишет то же число в лист."""
    if not delta:
        return
    live_xp = await _bump_live_character_xp(db, scenario_id, character_id, delta)
    character = await db.get(models.PlayerCharacter, character_id)
    if character is None:
        return
    data = dict(character.data or {})
    data["xp"] = live_xp if live_xp is not None else int(data.get("xp") or 0) + int(delta)
    character.data = data
    await db.commit()


async def _bump_live_character_xp(
    db: AsyncSession,
    scenario_id: UUID,
    character_id: UUID,
    delta: int,
) -> int | None:
    sessions = (
        await db.execute(
            select(models.GameSession).where(
                models.GameSession.scenario_id == scenario_id,
                models.GameSession.is_active == True,
            )
        )
    ).scalars().all()
    from app.managers.session_manager import session_manager

    want = str(character_id)
    for gs in sessions:
        try:
            sm = await session_manager.ensure_manager(str(gs.id))
            if not await sm.session_exists():
                continue
            inner = await sm.get_inner()
            characters = list(inner.characters or [])
            for character in characters:
                if str(character.id) != want:
                    continue
                data = dict(getattr(character, "data", None) or {})
                data["xp"] = int(data.get("xp") or 0) + int(delta)
                character.data = data
                await sm.set_field("characters", [item.model_dump(mode="json") for item in characters])
                return int(data["xp"])
        except Exception:
            continue
    return None


def line_out(row: models.ChronicleLine) -> dict[str, Any]:
    return {
        "id": row.id,
        "scenario_id": row.scenario_id,
        "kind": row.kind,
        "text": row.text or "",
        "subject_kind": row.subject_kind,
        "subject_id": row.subject_id,
        "real_at": row.real_at,
        "game_time": row.game_time,
        "scene_id": row.scene_id,
        "scene_time": row.scene_time,
        "location_id": row.location_id,
        "payload": row.payload or {},
        "author_user_id": row.author_user_id,
    }
