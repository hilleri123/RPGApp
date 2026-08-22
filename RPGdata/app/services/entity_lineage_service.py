"""Resolve and sync prep ↔ launched entity pairs."""

from __future__ import annotations

import uuid
from typing import Any, Optional, Type
from uuid import UUID

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, scheme

ENTITY_MODELS: dict[str, Type] = {
    "npc": models.NPC,
    "location": models.Location,
    "game_item": models.GameItem,
    "character": models.PlayerCharacter,
    "story_beat": models.StoryBeat,
    "note": models.Note,
    "counter": models.Counter,
    "obstacle": models.Obstacle,
    "scene_exposure": models.SceneExposure,
}

ENTITY_OUT: dict[str, type] = {
    "npc": scheme.NPCOut,
    "location": scheme.LocationOut,
    "game_item": scheme.GameItemOut,
    "character": scheme.PlayerCharacterOut,
    "story_beat": scheme.StoryBeatOut,
    "note": scheme.Note,
    "counter": scheme.Counter,
    "obstacle": scheme.ObstacleOut,
    "scene_exposure": scheme.SceneExposureOut,
}

_SYNC_ATTRS = (
    "name",
    "description_for_master",
    "description_for_players",
    "short_desc",
    "story",
    "text",
    "text_for_master",
    "text_for_players",
    "data",
    "tags",
    "icon_url",
    "img_url",
    "quest_html_mark",
    "note",
    "order_num",
    "is_shown",
    "is_start",
)


def _copy_sync_fields(src: Any, dst: Any) -> None:
    for attr in _SYNC_ATTRS:
        if hasattr(src, attr) and hasattr(dst, attr):
            val = getattr(src, attr)
            if val is not None or attr in ("data", "tags"):
                setattr(dst, attr, val)


async def _load_entity(
    db: AsyncSession, model: Type, entity_id: UUID, scenario_id: UUID
) -> Any | None:
    stmt = select(model).where(model.id == entity_id, model.scenario_id == scenario_id)
    return (await db.execute(stmt)).scalars().first()


def _serialize(entity: Any, entity_type: str) -> dict[str, Any]:
    out_cls = ENTITY_OUT.get(entity_type)
    if out_cls is None:
        return {"id": str(entity.id)}
    return out_cls.model_validate(entity).model_dump(mode="json")


async def get_entity_lineage(
    db: AsyncSession,
    *,
    scenario_id: UUID,
    entity_type: str,
    entity_id: UUID,
) -> scheme.EntityLineageOut:
    if entity_type not in ENTITY_MODELS:
        raise ValueError(f"unknown entity_type: {entity_type}")

    scenario = await db.get(models.Scenario, scenario_id)
    if not scenario:
        raise ValueError("scenario not found")

    model = ENTITY_MODELS[entity_type]
    current = await _load_entity(db, model, entity_id, scenario_id)
    if not current:
        raise ValueError("entity not found")

    prep_scenario_id = scenario.source_scenario_id if scenario.is_session_snapshot else scenario.id
    launched_scenario_id = scenario.id if scenario.is_session_snapshot else None

    prep_entity = None
    launched_entity = current if scenario.is_session_snapshot else current

    if scenario.is_session_snapshot:
        launched_entity = current
        src_id = getattr(current, "source_entity_id", None)
        if src_id and prep_scenario_id:
            prep_entity = await _load_entity(db, model, src_id, prep_scenario_id)
    else:
        prep_entity = current
        if prep_scenario_id:
            stmt = select(model).where(
                model.scenario_id != scenario_id,
                model.source_entity_id == entity_id,
            )
            launched_entity = (await db.execute(stmt)).scalars().first()

    prep_scenario = await db.get(models.Scenario, prep_scenario_id) if prep_scenario_id else None

    return scheme.EntityLineageOut(
        entity_type=entity_type,
        prep_scenario_id=prep_scenario_id,
        prep_scenario_name=getattr(prep_scenario, "name", None),
        launched_scenario_id=launched_scenario_id or (getattr(launched_entity, "scenario_id", None)),
        current_scenario_id=scenario_id,
        current_entity_id=entity_id,
        current=_serialize(current, entity_type),
        prep=_serialize(prep_entity, entity_type) if prep_entity else None,
        prep_entity_id=getattr(prep_entity, "id", None) if prep_entity else getattr(current, "source_entity_id", None),
        has_prep_entity=prep_entity is not None,
    )


async def sync_entity_lineage(
    db: AsyncSession,
    *,
    scenario_id: UUID,
    entity_type: str,
    entity_id: UUID,
    direction: str,
) -> scheme.EntityLineageOut:
    if direction not in ("to_prep", "to_launched"):
        raise ValueError("direction must be to_prep or to_launched")

    lineage = await get_entity_lineage(db, scenario_id=scenario_id, entity_type=entity_type, entity_id=entity_id)
    model = ENTITY_MODELS[entity_type]

    if direction == "to_prep":
        if not lineage.prep_entity_id or not lineage.prep_scenario_id:
            raise ValueError("prep entity missing")
        src = await _load_entity(db, model, entity_id, scenario_id)
        dst = await _load_entity(db, model, UUID(str(lineage.prep_entity_id)), lineage.prep_scenario_id)
    else:
        if not lineage.prep_entity_id or not lineage.launched_scenario_id:
            raise ValueError("launched entity missing")
        src = await _load_entity(db, model, UUID(str(lineage.prep_entity_id)), lineage.prep_scenario_id)
        launched_id = lineage.launched_scenario_id
        stmt = select(model).where(
            model.scenario_id == launched_id,
            model.source_entity_id == lineage.prep_entity_id,
        )
        dst = (await db.execute(stmt)).scalars().first()
        if not dst:
            raise ValueError("launched copy not found")

    if not src or not dst:
        raise ValueError("entities not found for sync")

    _copy_sync_fields(src, dst)
    await db.commit()
    return await get_entity_lineage(db, scenario_id=scenario_id, entity_type=entity_type, entity_id=entity_id)


async def ensure_prep_entity(
    db: AsyncSession,
    *,
    scenario_id: UUID,
    entity_type: str,
    entity_id: UUID,
) -> scheme.EntityLineageOut:
    scenario = await db.get(models.Scenario, scenario_id)
    if not scenario or not scenario.is_session_snapshot:
        raise ValueError("only launched scenario entities supported")

    prep_id = scenario.source_scenario_id
    if not prep_id:
        raise ValueError("prep scenario unknown")

    model = ENTITY_MODELS[entity_type]
    launched = await _load_entity(db, model, entity_id, scenario_id)
    if not launched:
        raise ValueError("entity not found")

    if launched.source_entity_id:
        prep = await _load_entity(db, model, launched.source_entity_id, prep_id)
        if prep:
            return await get_entity_lineage(db, scenario_id=scenario_id, entity_type=entity_type, entity_id=entity_id)

    new_id = uuid.uuid4()
    fields = {attr: getattr(launched, attr) for attr in _SYNC_ATTRS if hasattr(launched, attr)}
    fields = {k: v for k, v in fields.items() if v is not None}
    prep_entity = model(id=new_id, scenario_id=prep_id, **fields)
    db.add(prep_entity)
    launched.source_entity_id = new_id
    await db.commit()
    return await get_entity_lineage(db, scenario_id=scenario_id, entity_type=entity_type, entity_id=entity_id)


_PATCHABLE_FIELDS = frozenset(_SYNC_ATTRS)


def assert_launched_entity_deletable(scenario: models.Scenario, entity: Any) -> None:
    """Запрещает удаление объектов, скопированных из prep, в launched-сценарии."""
    if scenario.is_session_snapshot and getattr(entity, "source_entity_id", None):
        raise ValueError(
            "Нельзя удалить объект, скопированный из исходного сценария. "
            "Удалите только добавленные вручную элементы."
        )


async def patch_entity_lineage_fields(
    db: AsyncSession,
    *,
    scenario_id: UUID,
    entity_type: str,
    entity_id: UUID,
    side: str,
    fields: dict[str, Any],
) -> scheme.EntityLineageOut:
    if entity_type not in ENTITY_MODELS:
        raise ValueError("unknown entity type")
    if side not in ("current", "prep"):
        raise ValueError("side must be current or prep")

    lineage = await get_entity_lineage(
        db, scenario_id=scenario_id, entity_type=entity_type, entity_id=entity_id
    )
    model = ENTITY_MODELS[entity_type]

    if side == "current":
        target_id = entity_id
        target_scenario_id = scenario_id
    else:
        if not lineage.prep_entity_id or not lineage.prep_scenario_id:
            raise ValueError("prep entity not linked")
        target_id = lineage.prep_entity_id
        target_scenario_id = lineage.prep_scenario_id

    entity = await _load_entity(db, model, target_id, target_scenario_id)
    if not entity:
        raise ValueError("entity not found")

    for key, val in fields.items():
        if key not in _PATCHABLE_FIELDS or not hasattr(entity, key):
            continue
        setattr(entity, key, val)

    await db.commit()
    return await get_entity_lineage(
        db, scenario_id=scenario_id, entity_type=entity_type, entity_id=entity_id
    )
