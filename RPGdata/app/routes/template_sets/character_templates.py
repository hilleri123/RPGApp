from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, scheme
from app.auth import require_master
from app.constants.templates import ensure_template_tags
from app.infrastructure import s3_service
from app.infrastructure.database import get_async_session as get_db
from app.routes.template_sets._helpers import apply_rule_item_ownership_template
from app.scheme.common import UpsertResult, dump_entity_fields
from app.scheme.character import CharacterUpsertPayload, CharacterUpsertResult

from app.routes._helpers import validate_entity_data
from app.routes.characters import _make_entity_payload
from app.services.entity_data_rule import merge_validated_entity_fields
from ._common import get_template_set_or_404
from .unified_helpers import (
    ensure_pack_member,
    get_pack_character_or_404,
    character_ids_in_pack,
)


router = APIRouter(
    prefix="/template_sets/{template_set_id}/characters",
    tags=["rule_character_templates"],
)


def _stmt_character_list(pack_id: UUID, skip: int, limit: int):
    return (
        select(models.PlayerCharacter)
        .where(
            models.PlayerCharacter.id.in_(character_ids_in_pack(pack_id)),
            models.PlayerCharacter.scenario_id.is_(None),
        )
        .order_by(models.PlayerCharacter.name.asc())
        .offset(skip)
        .limit(limit)
    )


@router.post("/validate", response_model=UpsertResult)
async def validate_character_template(
    payload: CharacterUpsertPayload,
    template_set: models.EntityPack = Depends(get_template_set_or_404),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    result = await validate_entity_data(
        db=db,
        template_set_id=template_set.id,
        entity="character",
        payload=_make_entity_payload(payload),
    )
    return UpsertResult(**result.model_dump())


@router.get("", response_model=List[scheme.PlayerCharacterList])
async def get_all(
    skip: int = 0,
    limit: int = 100,
    template_set: models.EntityPack = Depends(get_template_set_or_404),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(_stmt_character_list(template_set.id, skip, limit))).scalars().all()
    return rows


@router.get("/{character_id}", response_model=scheme.PlayerCharacterOut)
async def get_by_id(
    character_id: UUID,
    template_set: models.EntityPack = Depends(get_template_set_or_404),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    return await get_pack_character_or_404(db, template_set.id, character_id)


@router.post("", response_model=CharacterUpsertResult)
async def create_character(
    data: str = Form(...),
    icon_file: Optional[UploadFile] = File(None),
    img_file: Optional[UploadFile] = File(None),
    template_set: models.EntityPack = Depends(get_template_set_or_404),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    payload = CharacterUpsertPayload.model_validate_json(data)

    res = await validate_character_template(
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
    obj = models.PlayerCharacter(**create_fields)
    db.add(obj)
    await db.flush()

    await ensure_pack_member(
        db, pack_id=template_set.id, entity_kind="player_character", entity_id=obj.id
    )

    if icon_file:
        obj.icon_url = await s3_service.upload_file(icon_file, "character/icon", str(obj.id))
    else:
        obj.icon_url = str(payload.icon_url) if payload.icon_url else None

    if img_file:
        obj.img_url = await s3_service.upload_file(img_file, "character/img", str(obj.id))
    else:
        obj.img_url = str(payload.img_url) if payload.img_url else None

    await db.commit()
    await db.refresh(obj)

    await apply_rule_item_ownership_template(
        db,
        template_set_id=template_set.id,
        owner_type=models.OwnerTypeEnum.character,
        owner_id=obj.id,
        owned_items=payload.owned_items,
    )
    await db.commit()

    entity_out = await get_by_id(obj.id, template_set, current_user, db)
    return CharacterUpsertResult(**res.model_dump(), character=entity_out)


@router.put("/{character_id}", response_model=CharacterUpsertResult)
async def update(
    character_id: UUID,
    data: str = Form(...),
    icon_file: Optional[UploadFile] = File(None),
    img_file: Optional[UploadFile] = File(None),
    template_set: models.EntityPack = Depends(get_template_set_or_404),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    obj = await get_pack_character_or_404(db, template_set.id, character_id)
    payload = CharacterUpsertPayload.model_validate_json(data)

    res = await validate_character_template(
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
        obj.icon_url = await s3_service.upload_file(icon_file, "character/icon", str(obj.id))
    else:
        obj.icon_url = str(payload.icon_url) if payload.icon_url else None

    if img_file:
        obj.img_url = await s3_service.upload_file(img_file, "character/img", str(obj.id))
    else:
        obj.img_url = str(payload.img_url) if payload.img_url else None

    await db.commit()

    await apply_rule_item_ownership_template(
        db,
        template_set_id=template_set.id,
        owner_type=models.OwnerTypeEnum.character,
        owner_id=obj.id,
        owned_items=payload.owned_items,
    )
    await db.commit()

    entity_out = await get_by_id(obj.id, template_set, current_user, db)
    return CharacterUpsertResult(**res.model_dump(), character=entity_out)


@router.delete("/{character_id}", response_model=dict)
async def delete(
    character_id: UUID,
    template_set: models.EntityPack = Depends(get_template_set_or_404),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    obj = await get_pack_character_or_404(db, template_set.id, character_id)
    await db.delete(obj)
    await db.commit()
    return {"ok": True}
