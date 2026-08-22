from __future__ import annotations
from typing import Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from fastapi import HTTPException
from app import models
from app.plugins.registry_singleton import registry
from app.logger import logger


async def get_factory_for_scenario(db: AsyncSession, scenario_id: UUID):
    scenario = (await db.execute(
        select(models.Scenario).where(models.Scenario.id == scenario_id)
    )).scalars().first()

    if not scenario:
        return None, None

    # ВАЖНО: подстрой под реальное поле в Scenario
    plugin_id = getattr(scenario, "rule_id_str", None)  # например "gumshoe"
    
    if not plugin_id:
        # вместо KeyError: None
        raise HTTPException(status_code=400, detail="Scenario has no ruleset_id (plugin_id)")

    try:
        plugin = registry.get(plugin_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Ruleset plugin not found: {plugin_id}")

    return scenario, plugin.get_factory()



async def get_factory_for_template_set(db: AsyncSession, template_set_id: UUID):
    pack = (await db.execute(
        select(models.EntityPack).where(models.EntityPack.id == template_set_id)
    )).scalars().first()

    if not pack:
        return None, None

    plugin_id = getattr(pack, "rule_id_str", None)
    
    if not plugin_id:
        raise HTTPException(status_code=400, detail="TemplateSet has no ruleset_id (plugin_id)")

    try:
        plugin = registry.get(plugin_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Ruleset plugin not found: {plugin_id}")

    return pack, plugin.get_factory()


async def get_factory_from_db(
    db: AsyncSession,
    scenario_id: Optional[UUID] = None,
    template_set_id: Optional[UUID] = None,
):
    factory = None
    if scenario_id:
        _, factory = await get_factory_for_scenario(db, scenario_id)
    elif template_set_id:
        _, factory = await get_factory_for_template_set(db, template_set_id)
    return factory


async def get_factory_by_rule_id_str(
    db: AsyncSession,
    rule_id_str: str,
):
    """
    Получает фабрику плагина напрямую по rule_id_str,
    без привязки к сценарию или template_set.
    """
    try:
        plugin = registry.get(rule_id_str)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Ruleset plugin not found: {rule_id_str}")

    return plugin.get_factory()