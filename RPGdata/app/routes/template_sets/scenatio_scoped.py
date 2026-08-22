from __future__ import annotations

from typing import Any, List
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, scheme
from app.auth import require_master
from app.infrastructure.database import get_async_session as get_db
from app.services.template_entities import (
    enrich_template_entities_for_scenario,
    load_template_characters_for_scenario,
    load_template_items_for_scenario,
    load_template_npcs_for_scenario,
)

router = APIRouter(
    prefix="/scenarios/{scenario_id}",
    tags=["rule_templates"],
)


async def _enriched_list(
    db: AsyncSession,
    *,
    scenario_id: UUID,
    entity_kind: str,
    rows: list[Any],
    skip: int,
    limit: int,
) -> list[dict[str, Any]]:
    sliced = rows[skip : skip + limit]
    return await enrich_template_entities_for_scenario(
        db,
        scenario_id=scenario_id,
        entity_kind=entity_kind,
        rows=sliced,
    )


@router.get("/template_npcs")
async def get_template_npcs_for_scenario(
    scenario_id: UUID,
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    rows = await load_template_npcs_for_scenario(db, scenario_id)
    return await _enriched_list(
        db,
        scenario_id=scenario_id,
        entity_kind="npc",
        rows=rows,
        skip=skip,
        limit=limit,
    )


@router.get("/template_items")
async def get_template_items_for_scenario(
    scenario_id: UUID,
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    rows = await load_template_items_for_scenario(db, scenario_id)
    return await _enriched_list(
        db,
        scenario_id=scenario_id,
        entity_kind="game_item",
        rows=rows,
        skip=skip,
        limit=limit,
    )


@router.get("/template_characters")
async def get_template_characters_for_scenario(
    scenario_id: UUID,
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    rows = await load_template_characters_for_scenario(db, scenario_id)
    return await _enriched_list(
        db,
        scenario_id=scenario_id,
        entity_kind="player_character",
        rows=rows,
        skip=skip,
        limit=limit,
    )
