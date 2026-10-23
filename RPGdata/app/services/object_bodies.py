"""GET пачки объектов: тело по id, проекция по роли. Сцена уходит набором id."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select

from app.infrastructure.database import AsyncSessionLocal
from app.models.inventory import Inventory, InventoryItem, InventoryParticipant
from app.models.roll_gesture import RollGesture
from app.services.roll_persist import seed_image_url
from app.services.visibility_service import character_ids_for_user, load_visible_keys

_LISTS = {
    "player_character": "characters",
    "npc": "npcs",
    "game_item": "items",
    "location": "locations",
    "obstacle": "obstacles",
    "note": "notes",
    "story_beat": "story_beats",
    "scene": "scenes",
    "action": "actions",
    "log": "logs",
    "audio_queue": "audio_queue",
}

_STRIP_TYPES = {
    "player_character": "player_character",
    "npc": "npc",
    "game_item": "game_item",
    "location": "location",
}


def _dump(obj: Any) -> dict | None:
    if obj is None:
        return None
    if hasattr(obj, "model_dump"):
        return obj.model_dump(mode="json")
    if isinstance(obj, dict):
        return dict(obj)
    return None


def _find(inner: Any, field: str, object_id: UUID) -> Any:
    for obj in getattr(inner, field, None) or []:
        oid = obj.get("id") if isinstance(obj, dict) else getattr(obj, "id", None)
        if oid is not None and str(oid) == str(object_id):
            return obj
    return None


def _hide_master_fields(body: dict) -> dict:
    out = dict(body)
    if "description_for_master" in out:
        out["description_for_master"] = ""
    return out


def _player_scene(body: dict) -> dict:
    out = dict(body)
    out["private"] = {"npc_ids": [], "item_ids": [], "obstacle_ids": [], "obstacles": []}
    return out


async def _inventory_body(object_id: UUID) -> dict | None:
    async with AsyncSessionLocal() as db:
        row = await db.get(Inventory, object_id)
        if row is None:
            return None
        participants = (
            await db.execute(
                select(InventoryParticipant).where(InventoryParticipant.inventory_id == object_id)
            )
        ).scalars().all()
        items = (
            await db.execute(select(InventoryItem).where(InventoryItem.inventory_id == object_id))
        ).scalars().all()
    return {
        "id": str(row.id),
        "scenario_id": str(row.scenario_id),
        "name": row.name,
        "version": row.version,
        "participants": [
            {"participant_type": p.participant_type, "participant_id": str(p.participant_id)}
            for p in participants
        ],
        "items": [
            {"item_id": str(item.item_id), "qty": item.qty, "equipped": item.equipped}
            for item in items
        ],
    }


async def _gesture_body(object_id: UUID) -> dict | None:
    async with AsyncSessionLocal() as db:
        row = await db.get(RollGesture, object_id)
    if row is None:
        return None
    return {
        "id": str(row.id),
        "seed_hash": row.seed_hash,
        "gesture_url": seed_image_url(row.image_ref),
        "reason": row.reason,
        "version": row.version,
    }


async def project_objects(session_id: UUID, user, pairs: list[tuple[str, UUID]]) -> list[dict]:
    from app.managers import session_manager

    manager = await session_manager.ensure_manager(str(session_id))
    is_master = await manager.is_master(user)
    zone = await load_visible_keys(session_id, user.id)
    inner = await manager.get_inner()
    access_map = None
    own_ids: set[UUID] = set()
    if not is_master:
        _, records = await manager.get_player_seen_sets(user.id)
        access_map = manager._seen_access_map(records)
        own_ids = character_ids_for_user(inner, user.id)

    out: list[dict] = []
    for object_type, object_id in pairs:
        if object_type == "gesture":
            if not is_master and not await manager.is_player(user):
                continue
        elif (object_type, object_id) not in zone:
            continue
        body = await _project_one(
            manager,
            inner,
            object_type,
            object_id,
            is_master=is_master,
            access_map=access_map,
            own_ids=own_ids,
        )
        if body is None:
            continue
        out.append({"object_type": object_type, "object_id": str(object_id), "body": body})
    return out


async def _project_one(
    manager,
    inner,
    object_type: str,
    object_id: UUID,
    *,
    is_master: bool,
    access_map,
    own_ids: set[UUID],
) -> dict | None:
    if object_type == "inventory":
        return await _inventory_body(object_id)
    if object_type == "gesture":
        return await _gesture_body(object_id)

    field = _LISTS.get(object_type)
    if field is None:
        return None
    found = _find(inner, field, object_id)
    if found is None:
        return None

    if not is_master and object_type in _STRIP_TYPES and access_map is not None:
        if object_type == "player_character" and object_id in own_ids:
            body = _dump(found)
        elif object_type == "location":
            body = _dump(manager._strip_tags_for_player(found))
        else:
            body = _dump(manager._strip_entity_data_for_player(found, _STRIP_TYPES[object_type], access_map))
    else:
        body = _dump(found)

    if body is None:
        return None
    if not is_master:
        body = _hide_master_fields(body)
        if object_type == "scene":
            body = _player_scene(body)
        if object_type == "action":
            body.pop("scene", None)
    return body
