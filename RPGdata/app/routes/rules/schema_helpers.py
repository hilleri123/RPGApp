from __future__ import annotations

import hashlib
import json
from typing import Any, Optional, Tuple
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.plugins.registry_singleton import registry
from app.plugins.resolver import get_factory_from_db, get_factory_by_rule_id_str
from app.services.entity_data_rule import stamp_entity_data


def compute_schema_etag(schema: dict[str, Any], plugin_version: str) -> str:
    blob = json.dumps(schema, sort_keys=True, default=str, ensure_ascii=False)
    digest = hashlib.sha256(f"{plugin_version}:{blob}".encode("utf-8")).hexdigest()[:32]
    return f'"{digest}"'


async def resolve_plugin_meta_for_scenario(
    db: AsyncSession,
    scenario_id: UUID,
) -> Tuple[str, str]:
    scenario = (
        await db.execute(select(models.Scenario).where(models.Scenario.id == scenario_id))
    ).scalars().first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")

    rule_id_str = getattr(scenario, "rule_id_str", None)
    if not rule_id_str:
        raise HTTPException(status_code=400, detail="Scenario has no ruleset_id (plugin_id)")

    try:
        plugin = registry.get(rule_id_str)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Ruleset plugin not found: {rule_id_str}")

    return rule_id_str, plugin.plugin_version


async def resolve_plugin_meta_for_template_set(
    db: AsyncSession,
    template_set_id: UUID,
) -> Tuple[str, str]:
    template_set = (
        await db.execute(
            select(models.EntityPack).where(models.EntityPack.id == template_set_id)
        )
    ).scalars().first()
    if not template_set:
        raise HTTPException(status_code=404, detail="Template set not found")

    rule_id_str = getattr(template_set, "rule_id_str", None)
    if not rule_id_str:
        raise HTTPException(status_code=400, detail="TemplateSet has no ruleset_id (plugin_id)")

    try:
        plugin = registry.get(rule_id_str)
        return rule_id_str, plugin.plugin_version
    except KeyError:
        pass

    linked_scenario_id = (
        await db.execute(
            select(models.ScenarioEntityPackLink.scenario_id)
            .where(models.ScenarioEntityPackLink.pack_id == template_set_id)
            .order_by(models.ScenarioEntityPackLink.order_num.asc())
            .limit(1)
        )
    ).scalar_one_or_none()

    if linked_scenario_id:
        scenario = await db.get(models.Scenario, linked_scenario_id)
        fallback_rule = getattr(scenario, "rule_id_str", None) if scenario else None
        if fallback_rule and fallback_rule != rule_id_str:
            try:
                plugin = registry.get(fallback_rule)
                template_set.rule_id_str = fallback_rule
                await db.commit()
                return fallback_rule, plugin.plugin_version
            except KeyError:
                pass

    raise HTTPException(status_code=404, detail=f"Ruleset plugin not found: {rule_id_str}")


def plugin_meta_by_rule_id(rule_id_str: str) -> Tuple[str, str]:
    try:
        plugin = registry.get(rule_id_str)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Ruleset '{rule_id_str}' not found")
    return rule_id_str, plugin.plugin_version


async def factory_handle(
    *,
    db: AsyncSession,
    scenario_id: Optional[UUID],
    template_set_id: Optional[UUID],
    rule_id_str: Optional[str],
    entity: str,
    kind: str,
    context: dict[str, Any],
    payload: Any = None,
):
    if rule_id_str:
        factory = await get_factory_by_rule_id_str(db, rule_id_str)
    else:
        factory = await get_factory_from_db(db, scenario_id, template_set_id)

    if not factory:
        raise HTTPException(status_code=404, detail="Ruleset not found")

    result = factory.handle(kind=kind, entity=entity, payload=payload, context=context)
    rule_id = rule_id_str or getattr(factory, "system_id", None)
    if rule_id and isinstance(result, dict) and result.get("data") is not None:
        result = {**result, "data": stamp_entity_data(result["data"], rule_id)}
    return result
