from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException, status
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app import models, scheme
from app.auth import require_master
from app.infrastructure import s3_service
from app.infrastructure.database import get_async_session as get_db
from app.plugins.contracts import EntityPayload
from app.scheme.common import UpsertResult, dump_entity_fields
from app.scheme.game_item import ItemUpsertPayload, ItemUpsertResult
from ._helpers import get_scenario_or_404, get_scenario_edit, validate_entity_data, apply_item_ownership, notify_active_sessions_for_scenario


router = APIRouter(prefix="/scenarios/{scenario_id}/items", tags=["items"])


# ---------------------------------------------------------------------------
# Внутренние утилиты
# ---------------------------------------------------------------------------

def _stmt_item_list(scenario_id: UUID, skip: int, limit: int):
    return (
        select(models.GameItem)
        .options(
            selectinload(models.GameItem.ownership_link).selectinload(models.ItemOwnership.character),
            selectinload(models.GameItem.ownership_link).selectinload(models.ItemOwnership.npc),
            selectinload(models.GameItem.ownership_link).selectinload(models.ItemOwnership.owner_item),
            
            selectinload(models.GameItem.scene_exposures),  # <- добавили
        )
        .where(models.GameItem.scenario_id == scenario_id)
        .offset(skip)
        .limit(limit)
        .order_by(models.GameItem.name.asc())
    )


def _stmt_item_full(item_id: UUID, scenario_id: UUID):
    return (
        select(models.GameItem)
        .options(
            selectinload(models.GameItem.ownership_link).selectinload(models.ItemOwnership.character),
            selectinload(models.GameItem.ownership_link).selectinload(models.ItemOwnership.npc),
            selectinload(models.GameItem.ownership_link).selectinload(models.ItemOwnership.owner_item),
        )
        .where(
            models.GameItem.id == item_id,
            models.GameItem.scenario_id == scenario_id,
        )
    )




async def _get_item_or_404(db: AsyncSession, item_id: UUID, scenario_id: UUID) -> scheme.GameItemOut:
    obj = (await db.execute(_stmt_item_full(item_id, scenario_id))).scalars().first()
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Предмет не найден")
    return scheme.GameItemOut.model_validate(obj)


def _make_entity_payload(payload: ItemUpsertPayload) -> EntityPayload:
    """Единственная точка сопряжения ItemUpsertPayload → EntityPayload."""
    return EntityPayload(
        data=payload.model_dump(mode="json")["data"],
        tags=payload.tags or [],
    )


# ---------------------------------------------------------------------------
# Эндпоинты
# ---------------------------------------------------------------------------

@router.post("/validate", response_model=UpsertResult)
async def validate_item(
    payload: ItemUpsertPayload,
    scenario: models.Scenario = Depends(get_scenario_edit),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    result = await validate_entity_data(
        db=db,
        entity="item",
        payload=_make_entity_payload(payload),
        scenario_id=scenario.id,
    )
    return UpsertResult(**result.model_dump())


@router.get("", response_model=list[scheme.GameItemWithOwnerShort])
async def list_items_with_owner(
    skip: int = 0,
    limit: int = 100,
    scenario: models.Scenario = Depends(get_scenario_or_404),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(_stmt_item_list(scenario.id, skip, limit))).scalars().all()
    return rows


@router.get("/{item_id}", response_model=scheme.GameItemOut)
async def get_by_id(
    item_id: UUID,
    scenario: models.Scenario = Depends(get_scenario_or_404),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    return await _get_item_or_404(db, item_id, scenario.id)


@router.post("", response_model=ItemUpsertResult)
async def create_item(
    data: str = Form(...),
    icon_file: Optional[UploadFile] = File(None),
    img_file: Optional[UploadFile] = File(None),
    scenario: models.Scenario = Depends(get_scenario_edit),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    payload = ItemUpsertPayload.model_validate_json(data)

    result = await validate_entity_data(
        db=db,
        entity="item",
        payload=_make_entity_payload(payload),
        scenario_id=scenario.id,
    )

    if not result.ok and not payload.force:
        return ItemUpsertResult(**result.model_dump(), item=None)

    plugin_data = result.result.model_dump(mode="json")
    entity_data = dump_entity_fields(payload, exclude={"contained_items"})
    for k in plugin_data:
        entity_data.pop(k, None)

    obj = models.GameItem(
        **entity_data,
        **plugin_data,
        scenario_id=scenario.id,
    )
    db.add(obj)
    await db.commit()
    await db.refresh(obj)


    obj.icon_url = await s3_service.upload_file(icon_file, "item/icon", str(obj.id)) \
        if icon_file else (str(payload.icon_url) if payload.icon_url else None)
    obj.img_url = await s3_service.upload_file(img_file, "item/img", str(obj.id)) \
        if img_file else (str(payload.img_url) if payload.img_url else None)

    await db.commit()

    await apply_item_ownership(
        db,
        owner_id=obj.id,
        owner_type=models.OwnerTypeEnum.item,
        scenario_id=obj.scenario_id,
        owned_items=payload.contained_items,
    )
    await db.commit()

    item = await _get_item_or_404(db, obj.id, scenario.id)
    await notify_active_sessions_for_scenario(db, scenario, ["items"])
    return ItemUpsertResult(**result.model_dump(), item=item)


@router.put("/{item_id}", response_model=ItemUpsertResult)
async def update_item(
    item_id: UUID,
    data: str = Form(...),
    icon_file: Optional[UploadFile] = File(None),
    img_file: Optional[UploadFile] = File(None),
    scenario: models.Scenario = Depends(get_scenario_edit),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    # Зависимости роутов проверяют права на сценарий из запроса, а не на
    # сущность. Без фильтра по scenario_id мастер сценария A правил бы
    # сущность сценария B, подставив свой scenario_id и чужой id.
    obj = (await db.execute(
        select(models.GameItem).where(
            models.GameItem.id == item_id,
            models.GameItem.scenario_id == scenario.id,
        )
    )).scalars().first()
    if not obj:
        raise HTTPException(status_code=404, detail="Предмет не найден")

    payload = ItemUpsertPayload.model_validate_json(data)

    result = await validate_entity_data(
        db=db,
        entity="item",
        payload=_make_entity_payload(payload),
        scenario_id=scenario.id,
    )

    if not result.ok and not payload.force:
        return ItemUpsertResult(**result.model_dump(), item=None)

    update_fields = dump_entity_fields(
        payload,
        exclude={"contained_items"},
        exclude_unset=True,
        exclude_none=True,
    )
    update_fields["data"] = result.result.data
    update_fields["tags"] = result.result.tags

    for k, v in update_fields.items():
        setattr(obj, k, v)
    

    obj.icon_url = await s3_service.upload_file(icon_file, "item/icon", str(obj.id)) \
        if icon_file else (str(payload.icon_url) if payload.icon_url else None)
    obj.img_url = await s3_service.upload_file(img_file, "item/img", str(obj.id)) \
        if img_file else (str(payload.img_url) if payload.img_url else None)

    await db.commit()

    await apply_item_ownership(
        db,
        owner_id=obj.id,
        owner_type=models.OwnerTypeEnum.item,
        scenario_id=obj.scenario_id,
        owned_items=payload.contained_items,
    )
    await db.commit()

    item = await _get_item_or_404(db, obj.id, scenario.id)
    await notify_active_sessions_for_scenario(db, scenario, ["items"])
    return ItemUpsertResult(**result.model_dump(), item=item)


@router.delete("/{item_id}", response_model=dict)
async def delete_item(
    item_id: UUID,
    scenario: models.Scenario = Depends(get_scenario_edit),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    # Зависимости роутов проверяют права на сценарий из запроса, а не на
    # сущность. Без фильтра по scenario_id мастер сценария A правил бы
    # сущность сценария B, подставив свой scenario_id и чужой id.
    obj = (await db.execute(
        select(models.GameItem).where(
            models.GameItem.id == item_id,
            models.GameItem.scenario_id == scenario.id,
        )
    )).scalars().first()
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Предмет не найден")

    from app.services.entity_lineage_service import assert_launched_entity_deletable

    try:
        assert_launched_entity_deletable(scenario, obj)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    await db.delete(obj)
    await db.commit()
    await notify_active_sessions_for_scenario(db, scenario, ["items"])
    return {"ok": True}


@router.post("/{item_id}/reset-owner", status_code=200)
async def reset_item_owner(
    item_id: UUID,
    scenario: models.Scenario = Depends(get_scenario_edit),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    item = (await db.execute(
        select(models.GameItem.id).where(
            models.GameItem.id == item_id,
            models.GameItem.scenario_id == scenario.id,
        )
    )).scalars().first()

    if not item:
        raise HTTPException(status_code=404, detail="Предмет не найден")

    await db.execute(
        delete(models.ItemOwnership).where(models.ItemOwnership.item_id == item_id)
    )
    await db.commit()
    return {"ok": True}
