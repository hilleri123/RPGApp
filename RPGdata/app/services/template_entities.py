"""
Load template (blueprint) entities for scenarios via entity packs and direct links.
"""

from __future__ import annotations

import json
from typing import Any, Iterable, List, Optional, Set
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import cast, or_, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app import models
from app.constants.templates import TEMPLATE_TAG, is_template_entity
from app.services.entity_data_rule import resolve_rule_id_from_data

ENTITY_KIND_MODEL: dict[str, type] = {
    "npc": models.NPC,
    "game_item": models.GameItem,
    "player_character": models.PlayerCharacter,
}


def _template_tag_filter(model):
    """JSON array contains 'template' (PostgreSQL jsonb @>)."""
    return cast(model.tags, JSONB).contains([TEMPLATE_TAG])


async def get_enabled_pack_ids_for_scenario(db: AsyncSession, scenario_id: UUID) -> List[UUID]:
    rows = (
        await db.execute(
            select(models.ScenarioEntityPackLink.pack_id)
            .where(
                models.ScenarioEntityPackLink.scenario_id == scenario_id,
                models.ScenarioEntityPackLink.enabled.is_(True),
            )
            .order_by(models.ScenarioEntityPackLink.order_num.asc())
        )
    ).scalars().all()
    return list(rows)


async def get_direct_template_entity_ids(
    db: AsyncSession,
    scenario_id: UUID,
    entity_kind: str,
) -> List[UUID]:
    rows = (
        await db.execute(
            select(models.ScenarioTemplateEntityLink.entity_id)
            .where(
                models.ScenarioTemplateEntityLink.scenario_id == scenario_id,
                models.ScenarioTemplateEntityLink.entity_kind == entity_kind,
                models.ScenarioTemplateEntityLink.enabled.is_(True),
            )
            .order_by(models.ScenarioTemplateEntityLink.order_num.asc())
        )
    ).scalars().all()
    return list(rows)


async def get_entity_ids_in_packs(
    db: AsyncSession,
    pack_ids: Iterable[UUID],
    entity_kind: str,
) -> Set[UUID]:
    if not pack_ids:
        return set()
    rows = (
        await db.execute(
            select(models.EntityPackMember.entity_id).where(
                models.EntityPackMember.pack_id.in_(list(pack_ids)),
                models.EntityPackMember.entity_kind == entity_kind,
            )
        )
    ).scalars().all()
    return set(rows)


async def resolve_template_entity_ids_for_scenario(
    db: AsyncSession,
    scenario_id: UUID,
    entity_kind: str,
) -> Set[UUID]:
    pack_ids = await get_enabled_pack_ids_for_scenario(db, scenario_id)
    ids: Set[UUID] = await get_entity_ids_in_packs(db, pack_ids, entity_kind)
    direct = await get_direct_template_entity_ids(db, scenario_id, entity_kind)
    ids.update(direct)
    return ids


async def load_template_npcs_for_scenario(
    db: AsyncSession,
    scenario_id: UUID,
) -> List[models.NPC]:
    ids = await resolve_template_entity_ids_for_scenario(db, scenario_id, "npc")
    if not ids:
        return []
    stmt = (
        select(models.NPC)
        .where(
            models.NPC.id.in_(ids),
            models.NPC.scenario_id.is_(None),
            _template_tag_filter(models.NPC),
        )
        .options(
            selectinload(models.NPC.owned_item_links).selectinload(models.ItemOwnership.item),
            selectinload(models.NPC.scene_exposure_template_links).selectinload(
                models.SceneExposureTemplateNPC.scene_exposure
            ),
        )
        .order_by(models.NPC.name.asc())
    )
    return list((await db.execute(stmt)).scalars().all())


async def load_template_items_for_scenario(
    db: AsyncSession,
    scenario_id: UUID,
) -> List[models.GameItem]:
    ids = await resolve_template_entity_ids_for_scenario(db, scenario_id, "game_item")
    if not ids:
        return []
    stmt = (
        select(models.GameItem)
        .where(
            models.GameItem.id.in_(ids),
            models.GameItem.scenario_id.is_(None),
            _template_tag_filter(models.GameItem),
        )
        .options(selectinload(models.GameItem.scene_exposure_template_links))
        .order_by(models.GameItem.name.asc())
    )
    return list((await db.execute(stmt)).scalars().all())


async def load_template_characters_for_scenario(
    db: AsyncSession,
    scenario_id: UUID,
) -> List[models.PlayerCharacter]:
    ids = await resolve_template_entity_ids_for_scenario(db, scenario_id, "player_character")
    if not ids:
        return []
    stmt = (
        select(models.PlayerCharacter)
        .where(
            models.PlayerCharacter.id.in_(ids),
            models.PlayerCharacter.scenario_id.is_(None),
            _template_tag_filter(models.PlayerCharacter),
        )
        .options(
            selectinload(models.PlayerCharacter.owned_item_links).selectinload(
                models.ItemOwnership.item
            ),
        )
        .order_by(models.PlayerCharacter.name.asc())
    )
    return list((await db.execute(stmt)).scalars().all())


async def load_entity_packs_for_scenario(
    db: AsyncSession,
    scenario_id: UUID,
) -> List[models.EntityPack]:
    pack_ids = await get_enabled_pack_ids_for_scenario(db, scenario_id)
    if not pack_ids:
        return []
    stmt = (
        select(models.EntityPack)
        .where(models.EntityPack.id.in_(pack_ids))
        .options(
            selectinload(models.EntityPack.members),
        )
    )
    packs = list((await db.execute(stmt)).scalars().all())
    order = {pid: i for i, pid in enumerate(pack_ids)}
    packs.sort(key=lambda p: order.get(p.id, 9999))
    return packs


async def load_pack_members_by_kind(
    db: AsyncSession,
    pack_id: UUID,
    entity_kind: str,
) -> List[UUID]:
    rows = (
        await db.execute(
            select(models.EntityPackMember.entity_id).where(
                models.EntityPackMember.pack_id == pack_id,
                models.EntityPackMember.entity_kind == entity_kind,
            )
        )
    ).scalars().all()
    return list(rows)


async def get_pack_or_404(db: AsyncSession, pack_id: UUID) -> models.EntityPack:
    from fastapi import HTTPException

    pack = (
        await db.execute(select(models.EntityPack).where(models.EntityPack.id == pack_id))
    ).scalars().first()
    if not pack:
        raise HTTPException(status_code=404, detail="Entity pack not found")
    return pack


def _entity_kind_model(entity_kind: str):
    model = ENTITY_KIND_MODEL.get(entity_kind)
    if not model:
        raise HTTPException(status_code=400, detail=f"Unknown entity_kind: {entity_kind}")
    return model


async def _pack_ids_for_rule(db: AsyncSession, rule_id_str: str) -> List[UUID]:
    rows = (
        await db.execute(
            select(models.EntityPack.id).where(models.EntityPack.rule_id_str == rule_id_str)
        )
    ).scalars().all()
    return list(rows)


async def _entity_ids_in_rule_packs(
    db: AsyncSession,
    *,
    rule_id_str: str,
    entity_kind: str,
) -> Set[UUID]:
    pack_ids = await _pack_ids_for_rule(db, rule_id_str)
    return await get_entity_ids_in_packs(db, pack_ids, entity_kind)


async def load_pack_memberships_for_entities(
    db: AsyncSession,
    *,
    entity_kind: str,
    entity_ids: Iterable[UUID],
    pack_ids: Iterable[UUID] | None = None,
) -> dict[UUID, list[UUID]]:
    ids = list(entity_ids)
    if not ids:
        return {}
    stmt = select(
        models.EntityPackMember.entity_id,
        models.EntityPackMember.pack_id,
    ).where(
        models.EntityPackMember.entity_kind == entity_kind,
        models.EntityPackMember.entity_id.in_(ids),
    )
    if pack_ids is not None:
        stmt = stmt.where(models.EntityPackMember.pack_id.in_(list(pack_ids)))
    rows = (await db.execute(stmt)).all()
    out: dict[UUID, list[UUID]] = {}
    for entity_id, pack_id in rows:
        out.setdefault(entity_id, []).append(pack_id)
    return out


async def load_pack_names(
    db: AsyncSession,
    pack_ids: Iterable[UUID],
) -> dict[UUID, str]:
    ids = list(set(pack_ids))
    if not ids:
        return {}
    rows = (
        await db.execute(
            select(models.EntityPack.id, models.EntityPack.name).where(
                models.EntityPack.id.in_(ids)
            )
        )
    ).all()
    return {row[0]: row[1] for row in rows}


def _rule_filter(model, rule_id_str: str, entity_ids_in_packs: Set[UUID]):
    clauses = []
    if entity_ids_in_packs:
        clauses.append(model.id.in_(entity_ids_in_packs))
    clauses.append(model.data["rule_id_str"].as_string() == rule_id_str)
    return or_(*clauses)


async def browse_template_entities_for_rule(
    db: AsyncSession,
    *,
    rule_id_str: str,
    entity_kind: str,
    search: str | None = None,
    exclude_ids: Set[UUID] | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[dict[str, Any]]:
    model = _entity_kind_model(entity_kind)
    entity_ids_in_packs = await _entity_ids_in_rule_packs(
        db, rule_id_str=rule_id_str, entity_kind=entity_kind
    )

    stmt = (
        select(model)
        .where(
            model.scenario_id.is_(None),
            _template_tag_filter(model),
            _rule_filter(model, rule_id_str, entity_ids_in_packs),
        )
        .order_by(model.name.asc())
    )
    if search:
        stmt = stmt.where(model.name.ilike(f"%{search.strip()}%"))
    if exclude_ids:
        stmt = stmt.where(model.id.notin_(list(exclude_ids)))

    rows = list((await db.execute(stmt.offset(skip).limit(limit))).scalars().all())
    if not rows:
        return []

    entity_ids = [row.id for row in rows]
    memberships = await load_pack_memberships_for_entities(
        db,
        entity_kind=entity_kind,
        entity_ids=entity_ids,
    )
    all_pack_ids = {pid for pids in memberships.values() for pid in pids}
    pack_names = await load_pack_names(db, all_pack_ids)

    result: list[dict[str, Any]] = []
    for row in rows:
        packs = memberships.get(row.id) or []
        primary_pack_id = packs[0] if packs else None
        result.append(
            {
                "id": row.id,
                "name": row.name,
                "tags": row.tags or [],
                "template_pack_id": primary_pack_id,
                "template_pack_name": pack_names.get(primary_pack_id) if primary_pack_id else None,
            }
        )
    return result


async def browse_template_entities_for_pack_add(
    db: AsyncSession,
    *,
    pack_id: UUID,
    entity_kind: str,
    search: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[dict[str, Any]]:
    pack = await get_pack_or_404(db, pack_id)
    member_ids = set(await load_pack_members_by_kind(db, pack_id, entity_kind))
    return await browse_template_entities_for_rule(
        db,
        rule_id_str=pack.rule_id_str,
        entity_kind=entity_kind,
        search=search,
        exclude_ids=member_ids,
        skip=skip,
        limit=limit,
    )


async def validate_template_entity_for_pack_link(
    db: AsyncSession,
    *,
    pack: models.EntityPack,
    entity_kind: str,
    entity_id: UUID,
) -> Any:
    model = _entity_kind_model(entity_kind)
    entity = (
        await db.execute(select(model).where(model.id == entity_id))
    ).scalars().first()
    if not entity:
        raise HTTPException(status_code=404, detail="Template entity not found")
    if getattr(entity, "scenario_id", None) is not None:
        raise HTTPException(status_code=400, detail="Entity is bound to a scenario, not a template")
    if not is_template_entity(getattr(entity, "tags", None)):
        raise HTTPException(status_code=400, detail="Entity is not marked as template")

    entity_rule = resolve_rule_id_from_data(getattr(entity, "data", None))
    if entity_rule and entity_rule != pack.rule_id_str:
        raise HTTPException(status_code=400, detail="Template belongs to another ruleset")

    if not entity_rule:
        pack_ids = await _pack_ids_for_rule(db, pack.rule_id_str)
        memberships = await load_pack_memberships_for_entities(
            db,
            entity_kind=entity_kind,
            entity_ids=[entity_id],
            pack_ids=pack_ids,
        )
        if entity_id not in memberships:
            raise HTTPException(
                status_code=400,
                detail="Template is not available for this ruleset",
            )

    existing = set(await load_pack_members_by_kind(db, pack.id, entity_kind))
    if entity_id in existing:
        raise HTTPException(status_code=400, detail="Template is already in this pack")

    return entity


async def browse_unlinked_template_entities_for_scenario(
    db: AsyncSession,
    *,
    scenario_id: UUID,
    entity_kind: str,
    search: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[dict[str, Any]]:
    scenario = (
        await db.execute(select(models.Scenario).where(models.Scenario.id == scenario_id))
    ).scalars().first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Сценарий не найден")
    rule_id_str = getattr(scenario, "rule_id_str", None)
    if not rule_id_str:
        raise HTTPException(status_code=400, detail="Scenario has no rule_id_str")

    linked = await resolve_template_entity_ids_for_scenario(db, scenario_id, entity_kind)
    return await browse_template_entities_for_rule(
        db,
        rule_id_str=rule_id_str,
        entity_kind=entity_kind,
        search=search,
        exclude_ids=linked,
        skip=skip,
        limit=limit,
    )


async def validate_template_entity_for_scenario_link(
    db: AsyncSession,
    *,
    scenario: models.Scenario,
    entity_kind: str,
    entity_id: UUID,
) -> Any:
    model = _entity_kind_model(entity_kind)
    entity = (
        await db.execute(select(model).where(model.id == entity_id))
    ).scalars().first()
    if not entity:
        raise HTTPException(status_code=404, detail="Template entity not found")
    if getattr(entity, "scenario_id", None) is not None:
        raise HTTPException(status_code=400, detail="Entity is bound to a scenario, not a template")
    if not is_template_entity(getattr(entity, "tags", None)):
        raise HTTPException(status_code=400, detail="Entity is not marked as template")

    scenario_rule = getattr(scenario, "rule_id_str", None)
    entity_rule = resolve_rule_id_from_data(getattr(entity, "data", None))
    if entity_rule and scenario_rule and entity_rule != scenario_rule:
        raise HTTPException(status_code=400, detail="Template belongs to another ruleset")

    if scenario_rule and not entity_rule:
        pack_ids = await _pack_ids_for_rule(db, scenario_rule)
        memberships = await load_pack_memberships_for_entities(
            db,
            entity_kind=entity_kind,
            entity_ids=[entity_id],
            pack_ids=pack_ids,
        )
        if entity_id not in memberships:
            raise HTTPException(
                status_code=400,
                detail="Template is not available for this scenario ruleset",
            )

    return entity


async def enrich_template_entities_for_scenario(
    db: AsyncSession,
    *,
    scenario_id: UUID,
    entity_kind: str,
    rows: list[Any],
) -> list[dict[str, Any]]:
    if not rows:
        return []

    pack_ids = await get_enabled_pack_ids_for_scenario(db, scenario_id)
    primary_pack_id = pack_ids[0] if pack_ids else None
    direct_ids = set(await get_direct_template_entity_ids(db, scenario_id, entity_kind))
    entity_ids = [row.id for row in rows]
    memberships = await load_pack_memberships_for_entities(
        db,
        entity_kind=entity_kind,
        entity_ids=entity_ids,
        pack_ids=pack_ids or None,
    )
    all_pack_ids = {pid for pids in memberships.values() for pid in pids}
    if primary_pack_id:
        all_pack_ids.add(primary_pack_id)
    pack_names = await load_pack_names(db, all_pack_ids)

    enriched: list[dict[str, Any]] = []
    for row in rows:
        data = {
            c.key: getattr(row, c.key)
            for c in row.__table__.columns
        }
        if hasattr(row, "scene_exposure_template_links"):
            data["exposure_names"] = [
                link.scene_exposure.name
                for link in (row.scene_exposure_template_links or [])
                if getattr(link, "scene_exposure", None)
            ]
        packs = memberships.get(row.id) or []
        pack_id = packs[0] if packs else None
        is_primary_pack = bool(primary_pack_id and primary_pack_id in packs)
        is_direct_link = row.id in direct_ids
        data["template_pack_id"] = pack_id
        data["template_pack_name"] = pack_names.get(pack_id) if pack_id else None
        data["is_direct_link"] = is_direct_link
        data["is_primary_pack"] = is_primary_pack
        data["can_delete"] = is_primary_pack
        data["can_unlink"] = is_direct_link
        enriched.append(data)
    return enriched
