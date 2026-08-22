from __future__ import annotations

from uuid import UUID
from typing import Any, Dict, List, Optional

import json
from pydantic import ValidationError
from fastapi import APIRouter, Depends, HTTPException, Query, File, Form, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.infrastructure import s3_service
from app.infrastructure.database import get_async_session as get_db
from app.auth import require_master
from app.auth.permissions import PERM_EDIT_PARTIAL, PERM_READ
from app import models
from app.plugins.resolver import get_factory_for_scenario
from app.scheme.universal_entity import UniversalUpsertPayload, UniversalResult
from app.routes._helpers import require_scenario_by_id, validate_entity_data  # твоя функция, она уже умеет validate/enrich
from .helper import _apply_entity_fields, _entity_to_dict, _model_for, _parse_payload



router = APIRouter(prefix="/entities", tags=["entities"])



@router.post("/validate", response_model=UniversalResult)
async def validate_entity(
    payload: UniversalUpsertPayload,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    await require_scenario_by_id(db, current_user, payload.scenario_id, PERM_EDIT_PARTIAL)
    ok, issues, enriched = await validate_entity_data(
        db=db,
        scenario_id=payload.scenario_id,
        entity=payload.type,               # "character"|"npc"|"item"|"location"
        data=payload.data,
        user_id=current_user.id,
    )
    return UniversalResult(ok=ok, issues=issues, data=enriched, entity=None)

@router.post("", response_model=UniversalResult)
async def create_entity(
    payload: UniversalUpsertPayload,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    await require_scenario_by_id(db, current_user, payload.scenario_id, PERM_EDIT_PARTIAL)
    ok, issues, enriched = await validate_entity_data(
        db=db,
        scenario_id=payload.scenario_id,
        entity=payload.type,
        data=payload.data,
        user_id=current_user.id,
    )

    if (not ok) and (not payload.force):
        return UniversalResult(ok=False, issues=issues, data=enriched, entity=None)

    Model = _model_for(payload.type)
    obj = Model()

    # общие связи
    obj.scenario_id = payload.scenario_id

    # поля сущности напрямую в БД
    _apply_entity_fields(obj, payload.type, payload.entity_fields())

    # plugin-data в JSON колонку data (она должна быть в каждой модели)
    obj.data = enriched

    db.add(obj)
    await db.commit()
    await db.refresh(obj)

    return UniversalResult(
        ok=True,
        forced=(not ok) and payload.force,
        issues=issues,
        data=obj.data,
        entity=_entity_to_dict(obj),
    )

@router.put("/{entity_id}", response_model=UniversalResult)
async def update_entity(
    entity_id: UUID,
    payload: UniversalUpsertPayload,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    Model = _model_for(payload.type)

    obj = (await db.execute(
        select(Model).where(Model.id == entity_id)
    )).scalars().first()

    if not obj:
        raise HTTPException(404, "Entity not found")

    # scenario_id лучше брать из obj (защита от подмены)
    await require_scenario_by_id(db, current_user, obj.scenario_id, PERM_EDIT_PARTIAL)
    ok, issues, enriched = await validate_entity_data(
        db=db,
        scenario_id=obj.scenario_id,
        entity=payload.type,
        data=payload.data,
        user_id=current_user.id,
    )

    if (not ok) and (not payload.force):
        return UniversalResult(ok=False, issues=issues, data=enriched, entity=None)

    _apply_entity_fields(obj, payload.type, payload.entity_fields())
    obj.data = enriched


    await db.commit()
    await db.refresh(obj)

    return UniversalResult(
        ok=True,
        forced=(not ok) and payload.force,
        issues=issues,
        data=obj.data,
        entity=_entity_to_dict(obj),
    )

@router.get("", response_model=List[Dict[str, Any]])
async def list_entities(
    type: str = Query(...),
    scenario_id: UUID = Query(...),
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    await require_scenario_by_id(db, current_user, scenario_id, PERM_READ)
    Model = _model_for(type)
    stmt = (
        select(Model)
        .where(Model.scenario_id == scenario_id)
        .offset(skip)
        .limit(limit)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return [_entity_to_dict(x) for x in rows]

@router.get("/{entity_id}", response_model=Dict[str, Any])
async def get_entity(
    entity_id: UUID,
    type: str = Query(...),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    Model = _model_for(type)
    obj = (await db.execute(select(Model).where(Model.id == entity_id))).scalars().first()
    if not obj:
        raise HTTPException(404, "Entity not found")
    await require_scenario_by_id(db, current_user, obj.scenario_id, PERM_READ)
    return _entity_to_dict(obj)

@router.delete("/{entity_id}", response_model=dict)
async def delete_entity(
    entity_id: UUID,
    type: str = Query(...),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    Model = _model_for(type)
    obj = (await db.execute(select(Model).where(Model.id == entity_id))).scalars().first()
    if not obj:
        raise HTTPException(404, "Entity not found")
    await require_scenario_by_id(db, current_user, obj.scenario_id, PERM_EDIT_PARTIAL)
    await db.delete(obj)
    await db.commit()
    return {"ok": True}






async def _apply_assets(
    *,
    entity_type: str,
    entity_id: UUID,
    icon: Optional[UploadFile],
    image: Optional[UploadFile],
    map_file: Optional[UploadFile],
) -> Dict[str, Any]:
    fields: Dict[str, Any] = {}
    if icon:
        fields["icon_url"] = await s3_service.upload_file(
            icon, f"entity/{entity_type}/icon", str(entity_id)
        )
    if image:
        fields["img_url"] = await s3_service.upload_file(
            image, f"entity/{entity_type}/image", str(entity_id)
        )
    if map_file:
        fields["map_url"] = await s3_service.upload_file(
            map_file, f"entity/{entity_type}/map", str(entity_id)
        )
    return fields


@router.post("/multipart", response_model=UniversalResult)
async def create_entity_multipart(
    payload: str = Form(...),
    icon: Optional[UploadFile] = File(None),
    image: Optional[UploadFile] = File(None),
    map: Optional[UploadFile] = File(None),

    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    payload_obj = await _parse_payload(payload)

    await require_scenario_by_id(db, current_user, payload_obj.scenario_id, PERM_EDIT_PARTIAL)
    ok, issues, enriched = await validate_entity_data(
        db=db,
        scenario_id=payload_obj.scenario_id,
        entity=payload_obj.type,
        data=payload_obj.data,
        user_id=current_user.id,
    )

    if (not ok) and (not payload_obj.force):
        return UniversalResult(ok=False, issues=issues, data=enriched, entity=None)

    Model = _model_for(payload_obj.type)
    obj = Model()
    obj.scenario_id = payload_obj.scenario_id

    # на create сначала сохраним, чтобы получить id под s3 key
    _apply_entity_fields(obj, payload_obj.type, payload_obj.entity_fields())
    obj.data = enriched

    db.add(obj)
    await db.commit()
    await db.refresh(obj)

    if icon or image or map:
        asset_fields = await _apply_assets(
            entity_type=payload_obj.type,
            entity_id=obj.id,
            icon=icon,
            image=image,
            map_file=map,
        )
        _apply_entity_fields(
            obj,
            payload_obj.type,
            {**payload_obj.entity_fields(), **asset_fields},
        )
        await db.commit()
        await db.refresh(obj)

    return UniversalResult(
        ok=True,
        forced=(not ok) and payload_obj.force,
        issues=issues,
        data=obj.data,
        entity=_entity_to_dict(obj),
    )


@router.put("/{entity_id}/multipart", response_model=UniversalResult)
async def update_entity_multipart(
    entity_id: UUID,

    payload: str = Form(...),
    icon: Optional[UploadFile] = File(None),
    image: Optional[UploadFile] = File(None),
    map: Optional[UploadFile] = File(None),

    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    payload_obj = await _parse_payload(payload)

    Model = _model_for(payload_obj.type)
    obj = (await db.execute(select(Model).where(Model.id == entity_id))).scalars().first()
    if not obj:
        raise HTTPException(404, "Entity not found")

    await require_scenario_by_id(db, current_user, obj.scenario_id, PERM_EDIT_PARTIAL)
    ok, issues, enriched = await validate_entity_data(
        db=db,
        scenario_id=obj.scenario_id,
        data=payload_obj.data,
        user_id=current_user.id,
    )

    if (not ok) and (not payload_obj.force):
        return UniversalResult(ok=False, issues=issues, data=enriched, entity=None)

    entity_fields = payload_obj.entity_fields()
    if icon or image or map:
        asset_fields = await _apply_assets(
            entity_type=payload_obj.type,
            entity_id=obj.id,
            icon=icon,
            image=image,
            map_file=map,
        )
        entity_fields = {**entity_fields, **asset_fields}

    _apply_entity_fields(obj, payload_obj.type, entity_fields)
    obj.data = enriched

    await db.commit()
    await db.refresh(obj)

    return UniversalResult(
        ok=True,
        forced=(not ok) and payload_obj.force,
        issues=issues,
        data=obj.data,
        entity=_entity_to_dict(obj),
    )



