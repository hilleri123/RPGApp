from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app import models, scheme
from app.auth import require_master
from app.constants.templates import ensure_template_tags
from app.infrastructure import s3_service
from app.infrastructure.database import get_async_session as get_db
from app.scheme.common import UpsertResult, dump_entity_fields
from app.scheme.npc import NPCUpsertPayload, NPCUpsertResult

from app.routes._helpers import validate_entity_data
from app.routes.npcs import _make_entity_payload
from app.services.entity_data_rule import merge_validated_entity_fields
from ._common import get_template_set_or_404
from .unified_helpers import (
    apply_template_item_ownership,
    ensure_pack_member,
    get_pack_npc_or_404,
    npc_ids_in_pack,
)


router = APIRouter(
    prefix="/template_sets/{template_set_id}/npcs",
    tags=["rule_npc_templates"],
)


def _stmt_npc_list(pack_id: UUID, skip: int, limit: int):
    return (
        select(models.NPC)
        .options(selectinload(models.NPC.scene_exposure_template_links))
        .where(
            models.NPC.id.in_(npc_ids_in_pack(pack_id)),
            models.NPC.scenario_id.is_(None),
        )
        .order_by(models.NPC.name.asc())
        .offset(skip)
        .limit(limit)
    )


@router.post("/validate", response_model=UpsertResult)
async def validate_npc_template(
    payload: NPCUpsertPayload,
    template_set: models.EntityPack = Depends(get_template_set_or_404),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    result = await validate_entity_data(
        db=db,
        template_set_id=template_set.id,
        entity="npc",
        payload=_make_entity_payload(payload),
    )
    return UpsertResult(**result.model_dump())


@router.get("", response_model=List[scheme.NPCList])
async def get_all(
    skip: int = 0,
    limit: int = 100,
    template_set: models.EntityPack = Depends(get_template_set_or_404),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(_stmt_npc_list(template_set.id, skip, limit))).scalars().all()
    return rows


@router.get("/{npc_id}", response_model=scheme.NPCOut)
async def get_by_id(
    npc_id: UUID,
    template_set: models.EntityPack = Depends(get_template_set_or_404),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    return await get_pack_npc_or_404(db, template_set.id, npc_id)


@router.post("", response_model=NPCUpsertResult)
async def create_npc(
    data: str = Form(...),
    icon_file: Optional[UploadFile] = File(None),
    img_file: Optional[UploadFile] = File(None),
    template_set: models.EntityPack = Depends(get_template_set_or_404),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    payload = scheme.NPCUpsertPayload.model_validate_json(data)

    res = await validate_npc_template(
        db=db,
        template_set=template_set,
        payload=payload,
        current_user=current_user,
    )
    if (not res.ok) and (not payload.force):
        return res

    create_fields = merge_validated_entity_fields(
        payload=payload,
        plugin_payload=res.result,
        exclude={"owned_items", "location_id"},
        tags=ensure_template_tags(res.result.tags or payload.tags),
        extra={"scenario_id": None},
    )
    obj = models.NPC(**create_fields)
    db.add(obj)
    await db.flush()

    await ensure_pack_member(
        db, pack_id=template_set.id, entity_kind="npc", entity_id=obj.id
    )

    if icon_file:
        obj.icon_url = await s3_service.upload_file(icon_file, "npc/icon", str(obj.id))
    else:
        obj.icon_url = str(payload.icon_url) if payload.icon_url else None

    if img_file:
        obj.img_url = await s3_service.upload_file(img_file, "npc/img", str(obj.id))
    else:
        obj.img_url = str(payload.img_url) if payload.img_url else None

    await db.commit()
    await db.refresh(obj)

    await apply_template_item_ownership(
        db,
        pack_id=template_set.id,
        owner_type=models.OwnerTypeEnum.npc,
        owner_id=obj.id,
        owned_items=payload.owned_items,
    )
    await db.commit()

    entity_out = await get_by_id(obj.id, template_set, current_user, db)
    return NPCUpsertResult(**res.model_dump(), npc=entity_out)


@router.put("/{npc_id}", response_model=NPCUpsertResult)
async def update(
    npc_id: UUID,
    data: str = Form(...),
    icon_file: Optional[UploadFile] = File(None),
    img_file: Optional[UploadFile] = File(None),
    template_set: models.EntityPack = Depends(get_template_set_or_404),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    obj = await get_pack_npc_or_404(db, template_set.id, npc_id)
    payload = scheme.NPCUpsertPayload.model_validate_json(data)

    res = await validate_npc_template(
        db=db,
        template_set=template_set,
        payload=payload,
        current_user=current_user,
    )
    if (not res.ok) and (not payload.force):
        return res

    upd = dump_entity_fields(
        payload,
        exclude={"owned_items", "location_id", "id"},
        exclude_unset=True,
        exclude_none=True,
    )
    upd["data"] = res.result.data
    upd["tags"] = ensure_template_tags(res.result.tags or payload.tags)

    for k, v in upd.items():
        setattr(obj, k, v)

    if icon_file:
        obj.icon_url = await s3_service.upload_file(icon_file, "npc/icon", str(obj.id))
    else:
        obj.icon_url = str(payload.icon_url) if payload.icon_url else None

    if img_file:
        obj.img_url = await s3_service.upload_file(img_file, "npc/img", str(obj.id))
    else:
        obj.img_url = str(payload.img_url) if payload.img_url else None

    await db.commit()

    await apply_template_item_ownership(
        db,
        pack_id=template_set.id,
        owner_type=models.OwnerTypeEnum.npc,
        owner_id=obj.id,
        owned_items=payload.owned_items,
    )
    await db.commit()

    entity_out = await get_by_id(obj.id, template_set, current_user, db)
    return NPCUpsertResult(**res.model_dump(), npc=entity_out)


@router.delete("/{npc_id}", response_model=dict)
async def delete(
    npc_id: UUID,
    template_set: models.EntityPack = Depends(get_template_set_or_404),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    obj = await get_pack_npc_or_404(db, template_set.id, npc_id)
    await db.delete(obj)
    await db.commit()
    return {"ok": True}
