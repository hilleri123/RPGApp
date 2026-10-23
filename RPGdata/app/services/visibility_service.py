"""Зона видимости — набор id. Пересчёт только когда меняется состав."""

from __future__ import annotations

from typing import Any, Iterable
from uuid import UUID

from sqlalchemy import delete, select

from app.infrastructure.database import AsyncSessionLocal
from app.models.inventory import InventoryItem, InventoryParticipant
from app.models.object_change import ObjectChange
from app.models.visibility import VisibilityMember


def _uid(value: Any) -> UUID | None:
    if value is None:
        return None
    try:
        return UUID(str(value))
    except (TypeError, ValueError):
        return None


def _id_of(obj: Any) -> UUID | None:
    if isinstance(obj, dict):
        return _uid(obj.get("id"))
    return _uid(getattr(obj, "id", None))


def _ids(items: Iterable[Any] | None) -> list[UUID]:
    out: list[UUID] = []
    for item in items or []:
        oid = _id_of(item)
        if oid:
            out.append(oid)
    return out


def _side_ids(side: Any, kind: str) -> list[UUID]:
    if side is None:
        return []
    if isinstance(side, dict):
        raw = side.get(kind) or []
    else:
        raw = getattr(side, kind, None) or []
    return _ids(raw) if kind == "obstacles" else [_uid(x) for x in raw if _uid(x)]


def wanted_ids(
    inner: Any,
    *,
    role: str,
    user_id: UUID,
    character_ids: set[UUID],
) -> set[tuple[str, UUID]]:
    """Какие объекты видит роль. Мастер — сценарий целиком, игрок — свою сцену и сумки."""
    wanted: set[tuple[str, UUID]] = set()

    def add(object_type: str, oid: UUID | None) -> None:
        if oid:
            wanted.add((object_type, oid))

    characters = list(getattr(inner, "characters", None) or [])
    npcs = list(getattr(inner, "npcs", None) or [])
    items = list(getattr(inner, "items", None) or [])
    scenes = list(getattr(inner, "scenes", None) or [])
    actions = list(getattr(inner, "actions", None) or [])
    logs = list(getattr(inner, "logs", None) or [])
    audio_queue = list(getattr(inner, "audio_queue", None) or [])

    if role == "master":
        for obj in characters:
            add("player_character", _id_of(obj))
        for obj in npcs:
            add("npc", _id_of(obj))
        for obj in items:
            add("game_item", _id_of(obj))
        for obj in getattr(inner, "locations", None) or []:
            add("location", _id_of(obj))
        for obj in getattr(inner, "obstacles", None) or []:
            add("obstacle", _id_of(obj))
        for obj in getattr(inner, "notes", None) or []:
            add("note", _id_of(obj))
        for obj in getattr(inner, "story_beats", None) or []:
            add("story_beat", _id_of(obj))
        for scene in scenes:
            add("scene", _id_of(scene))
            _add_scene_members(wanted, scene, public_only=False)
        for action in actions:
            add("action", _id_of(action))
        for line in logs:
            add("log", _id_of(line))
        for entry in audio_queue:
            add("audio_queue", _id_of(entry))
        return wanted

    for obj in characters:
        oid = _id_of(obj)
        if oid in character_ids:
            add("player_character", oid)
    for scene in scenes:
        members = set(_scene_character_ids(scene))
        if not members & character_ids:
            continue
        add("scene", _id_of(scene))
        loc = scene.get("location_id") if isinstance(scene, dict) else getattr(scene, "location_id", None)
        add("location", _uid(loc))
        for cid in members:
            add("player_character", cid)
        _add_scene_members(wanted, scene, public_only=True)
    for note in getattr(inner, "notes", None) or []:
        owner = note.get("owner_user_id") if isinstance(note, dict) else getattr(note, "owner_user_id", None)
        if _uid(owner) == user_id:
            add("note", _id_of(note))
    settings = getattr(inner, "settings", None)
    audio_mode = settings.get("audio_mode") if isinstance(settings, dict) else getattr(settings, "audio_mode", None)
    if audio_mode == "local":
        for entry in audio_queue:
            add("audio_queue", _id_of(entry))
    for action in actions:
        participants = set()
        raw_ids = action.get("participantIds") if isinstance(action, dict) else getattr(action, "participantIds", None)
        for pid in raw_ids or []:
            uid = _uid(pid)
            if uid:
                participants.add(uid)
        if user_id in participants or participants & character_ids or not raw_ids:
            add("action", _id_of(action))
    for line in logs:
        add("log", _id_of(line))
    return wanted


def _scene_character_ids(scene: Any) -> list[UUID]:
    raw = scene.get("character_ids") if isinstance(scene, dict) else getattr(scene, "character_ids", None)
    return [oid for oid in (_uid(x) for x in raw or []) if oid]


def _add_scene_members(wanted: set[tuple[str, UUID]], scene: Any, *, public_only: bool) -> None:
    sides = ["public"] if public_only else ["public", "private"]
    for name in sides:
        side = scene.get(name) if isinstance(scene, dict) else getattr(scene, name, None)
        for oid in _side_ids(side, "npc_ids"):
            wanted.add(("npc", oid))
        for oid in _side_ids(side, "item_ids"):
            wanted.add(("game_item", oid))
        for oid in _side_ids(side, "obstacle_ids"):
            wanted.add(("obstacle", oid))
        for oid in _side_ids(side, "obstacles"):
            wanted.add(("obstacle", oid))


def character_ids_for_user(inner: Any, user_id: UUID) -> set[UUID]:
    found: set[UUID] = set()
    for player in getattr(inner, "players", None) or []:
        user = player.get("user") if isinstance(player, dict) else getattr(player, "user", None)
        uid = _id_of(user) if user is not None else _uid(player.get("user_id") if isinstance(player, dict) else None)
        if uid != user_id:
            continue
        character = player.get("character") if isinstance(player, dict) else getattr(player, "character", None)
        cid = _id_of(character)
        if cid:
            found.add(cid)
        bound = player.get("character_id") if isinstance(player, dict) else getattr(player, "character_id", None)
        bid = _uid(bound)
        if bid:
            found.add(bid)
    return found


async def replace_zone(session_id: UUID, user_id: UUID, wanted: set[tuple[str, UUID]]) -> None:
    async with AsyncSessionLocal() as db:
        rows = (
            await db.execute(
                select(VisibilityMember).where(
                    VisibilityMember.session_id == session_id,
                    VisibilityMember.user_id == user_id,
                )
            )
        ).scalars().all()
        current = {(row.object_type, row.object_id) for row in rows}
        appeared = wanted - current
        gone = current - wanted
        if not appeared and not gone:
            return
        for object_type, object_id in gone:
            await db.execute(
                delete(VisibilityMember).where(
                    VisibilityMember.session_id == session_id,
                    VisibilityMember.user_id == user_id,
                    VisibilityMember.object_type == object_type,
                    VisibilityMember.object_id == object_id,
                )
            )
            db.add(
                ObjectChange(
                    object_type=object_type,
                    object_id=object_id,
                    version=0,
                    op="gone",
                    session_id=session_id,
                )
            )
        for object_type, object_id in appeared:
            db.add(
                VisibilityMember(
                    session_id=session_id,
                    user_id=user_id,
                    object_type=object_type,
                    object_id=object_id,
                )
            )
            db.add(
                ObjectChange(
                    object_type=object_type,
                    object_id=object_id,
                    version=0,
                    op="appeared",
                    session_id=session_id,
                )
            )
        await db.commit()


async def add_inventory_visibility(session_id: UUID, user_id: UUID, character_ids: set[UUID]) -> None:
    if not character_ids:
        return
    async with AsyncSessionLocal() as db:
        participant_rows = (
            await db.execute(
                select(InventoryParticipant).where(
                    InventoryParticipant.participant_type == "character",
                    InventoryParticipant.participant_id.in_(character_ids),
                )
            )
        ).scalars().all()
        inventory_ids = {row.inventory_id for row in participant_rows}
        if not inventory_ids:
            return
        item_rows = (
            await db.execute(select(InventoryItem).where(InventoryItem.inventory_id.in_(inventory_ids)))
        ).scalars().all()
        extra = {("inventory", iid) for iid in inventory_ids}
        extra |= {("game_item", row.item_id) for row in item_rows}
        existing = (
            await db.execute(
                select(VisibilityMember).where(
                    VisibilityMember.session_id == session_id,
                    VisibilityMember.user_id == user_id,
                )
            )
        ).scalars().all()
        have = {(row.object_type, row.object_id) for row in existing}
        for object_type, object_id in extra - have:
            db.add(
                VisibilityMember(
                    session_id=session_id,
                    user_id=user_id,
                    object_type=object_type,
                    object_id=object_id,
                )
            )
            db.add(
                ObjectChange(
                    object_type=object_type,
                    object_id=object_id,
                    version=0,
                    op="appeared",
                    session_id=session_id,
                )
            )
        await db.commit()


async def rebuild_for_user(session_id: UUID, user_id: UUID, role: str) -> None:
    from app.managers import session_manager

    manager = await session_manager.ensure_manager(str(session_id))
    inner = await manager.get_inner()
    chars = character_ids_for_user(inner, user_id)
    wanted = wanted_ids(inner, role=role, user_id=user_id, character_ids=chars)
    await replace_zone(session_id, user_id, wanted)
    if role == "master":
        await _add_scenario_inventories(session_id, user_id, getattr(inner, "scenario_id", None))
    else:
        await add_inventory_visibility(session_id, user_id, chars)


async def _add_scenario_inventories(session_id: UUID, user_id: UUID, scenario_id) -> None:
    if not scenario_id:
        return
    from app.models.inventory import Inventory

    async with AsyncSessionLocal() as db:
        rows = (
            await db.execute(select(Inventory.id).where(Inventory.scenario_id == scenario_id))
        ).scalars().all()
        if not rows:
            return
        existing = (
            await db.execute(
                select(VisibilityMember.object_id).where(
                    VisibilityMember.session_id == session_id,
                    VisibilityMember.user_id == user_id,
                    VisibilityMember.object_type == "inventory",
                )
            )
        ).scalars().all()
        have = set(existing)
        for inventory_id in rows:
            if inventory_id in have:
                continue
            db.add(
                VisibilityMember(
                    session_id=session_id,
                    user_id=user_id,
                    object_type="inventory",
                    object_id=inventory_id,
                )
            )
        await db.commit()


async def load_visible_keys(session_id: UUID, user_id: UUID) -> set[tuple[str, UUID]]:
    async with AsyncSessionLocal() as db:
        rows = (
            await db.execute(
                select(VisibilityMember.object_type, VisibilityMember.object_id).where(
                    VisibilityMember.session_id == session_id,
                    VisibilityMember.user_id == user_id,
                )
            )
        ).all()
    return {(object_type, object_id) for object_type, object_id in rows}
