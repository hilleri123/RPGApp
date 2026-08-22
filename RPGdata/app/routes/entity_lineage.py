from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.auth import get_current_user
from app.infrastructure.database import get_async_session as get_db
from app import scheme
from app.services.entity_lineage_service import (
    ensure_prep_entity,
    get_entity_lineage,
    patch_entity_lineage_fields,
    sync_entity_lineage,
)

router = APIRouter(prefix="/scenarios", tags=["entity-lineage"])


@router.get("/{scenario_id}/entity-lineage/{entity_type}/{entity_id}")
async def read_entity_lineage(
    scenario_id: UUID,
    entity_type: str,
    entity_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await get_entity_lineage(
            db, scenario_id=scenario_id, entity_type=entity_type, entity_id=entity_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{scenario_id}/entity-lineage/sync")
async def sync_lineage(
    scenario_id: UUID,
    payload: scheme.EntityLineageSyncIn,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await sync_entity_lineage(
            db,
            scenario_id=scenario_id,
            entity_type=payload.entity_type,
            entity_id=payload.entity_id,
            direction=payload.direction,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{scenario_id}/entity-lineage/patch")
async def patch_lineage_fields(
    scenario_id: UUID,
    payload: scheme.EntityLineagePatchIn,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await patch_entity_lineage_fields(
            db,
            scenario_id=scenario_id,
            entity_type=payload.entity_type,
            entity_id=payload.entity_id,
            side=payload.side,
            fields=payload.fields,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{scenario_id}/entity-lineage/{entity_type}/{entity_id}/ensure-prep")
async def ensure_prep(
    scenario_id: UUID,
    entity_type: str,
    entity_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await ensure_prep_entity(
            db, scenario_id=scenario_id, entity_type=entity_type, entity_id=entity_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
