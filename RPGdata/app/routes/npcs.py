from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app import logger, models, scheme
from app.auth import require_master
from app.infrastructure import s3_service
from app.infrastructure.database import get_async_session as get_db
from app.plugins.contracts import EntityPayload
from app.scheme.common import UpsertResult, dump_entity_fields
from app.scheme.npc import NPCUpsertPayload, NPCUpsertResult
from ._helpers import get_scenario_or_404, get_scenario_edit, validate_entity_data, apply_item_ownership, notify_active_sessions_for_scenario


router = APIRouter(prefix="/scenarios/{scenario_id}/npcs", tags=["npcs"])


# ---------------------------------------------------------------------------
# Внутренние утилиты
# ---------------------------------------------------------------------------

def _stmt_npc_list(scenario_id: UUID, skip: int, limit: int):
    return (
        select(models.NPC).options(
            selectinload(models.NPC.scene_exposures),  # <- добавили
        )
        .where(models.NPC.scenario_id == scenario_id)
        .order_by(models.NPC.name.asc())
        .offset(skip)
        .limit(limit)
    )


def _stmt_npc_full(npc_id: UUID, scenario_id: UUID):
    return (
        select(models.NPC)
        .where(
            models.NPC.id == npc_id,
            models.NPC.scenario_id == scenario_id,
        )
        .options(
            selectinload(models.NPC.owned_item_links).selectinload(models.ItemOwnership.item)
        )
    )



async def _get_npc_or_404(db: AsyncSession, npc_id: UUID, scenario_id: UUID) -> scheme.NPCOut:
    obj = (await db.execute(_stmt_npc_full(npc_id, scenario_id))).scalars().first()
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="NPC не найден")
    return scheme.NPCOut.model_validate(obj)


def _make_entity_payload(payload: NPCUpsertPayload) -> EntityPayload:
    """Единственная точка сопряжения NPCUpsertPayload → EntityPayload."""
    return EntityPayload(
        data=payload.model_dump(mode="json")["data"],
        tags=payload.tags or [],
    )


# ---------------------------------------------------------------------------
# Эндпоинты
# ---------------------------------------------------------------------------

@router.post("/validate", response_model=UpsertResult)
async def validate_npc(
    payload: NPCUpsertPayload,
    scenario: models.Scenario = Depends(get_scenario_edit),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    result = await validate_entity_data(
        db=db,
        entity="npc",
        payload=_make_entity_payload(payload),
        scenario_id=scenario.id,
    )
    return UpsertResult(**result.model_dump())


@router.get("", response_model=List[scheme.NPCList])
async def get_all(
    skip: int = 0,
    limit: int = 100,
    scenario: models.Scenario = Depends(get_scenario_or_404),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(_stmt_npc_list(scenario.id, skip, limit))).scalars().all()
    return rows


@router.get("/{npc_id}", response_model=scheme.NPCOut)
async def get_by_id(
    npc_id: UUID,
    scenario: models.Scenario = Depends(get_scenario_or_404),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    return await _get_npc_or_404(db, npc_id, scenario.id)


@router.post("", response_model=NPCUpsertResult)
async def create_npc(
    data: str = Form(...),
    icon_file: Optional[UploadFile] = File(None),
    img_file: Optional[UploadFile] = File(None),
    scenario: models.Scenario = Depends(get_scenario_edit),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    payload = NPCUpsertPayload.model_validate_json(data)

    result = await validate_entity_data(
        db=db,
        entity="npc",
        payload=_make_entity_payload(payload),
        scenario_id=scenario.id,
    )

    if not result.ok and not payload.force:
        return NPCUpsertResult(**result.model_dump(), npc=None)

    plugin_data = result.result.model_dump(mode="json")
    entity_data = dump_entity_fields(payload, exclude={"owned_items"})
    for k in plugin_data:
        entity_data.pop(k, None)

    obj = models.NPC(
        **entity_data,
        **plugin_data,
        scenario_id=scenario.id,
    )
    db.add(obj)
    await db.commit()
    await db.refresh(obj)


    obj.icon_url = await s3_service.upload_file(icon_file, "npc/icon", str(obj.id)) \
        if icon_file else (str(payload.icon_url) if payload.icon_url else None)
    obj.img_url = await s3_service.upload_file(img_file, "npc/img", str(obj.id)) \
        if img_file else (str(payload.img_url) if payload.img_url else None)

    await db.commit()

    await apply_item_ownership(
        db,
        owner_id=obj.id,
        owner_type=models.OwnerTypeEnum.npc,
        scenario_id=obj.scenario_id,
        owned_items=payload.owned_items,
    )
    await db.commit()

    npc = await _get_npc_or_404(db, obj.id, scenario.id)
    await notify_active_sessions_for_scenario(db, scenario, ["npcs"])
    return NPCUpsertResult(**result.model_dump(), npc=npc)


@router.put("/{npc_id}", response_model=NPCUpsertResult)
async def update_npc(
    npc_id: UUID,
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
        select(models.NPC).where(
            models.NPC.id == npc_id,
            models.NPC.scenario_id == scenario.id,
        )
    )).scalars().first()
    if not obj:
        raise HTTPException(status_code=404, detail="NPC не найден")

    payload = NPCUpsertPayload.model_validate_json(data)

    result = await validate_entity_data(
        db=db,
        entity="npc",
        payload=_make_entity_payload(payload),
        scenario_id=scenario.id,
    )

    if not result.ok and not payload.force:
        return NPCUpsertResult(**result.model_dump(), npc=None)

    update_fields = dump_entity_fields(
        payload,
        exclude={"owned_items"},
        exclude_unset=True,
        exclude_none=True,
    )
    update_fields["data"] = result.result.data
    update_fields["tags"] = result.result.tags

    for k, v in update_fields.items():
        setattr(obj, k, v)


    obj.icon_url = await s3_service.upload_file(icon_file, "npc/icon", str(obj.id)) \
        if icon_file else (str(payload.icon_url) if payload.icon_url else None)
    obj.img_url = await s3_service.upload_file(img_file, "npc/img", str(obj.id)) \
        if img_file else (str(payload.img_url) if payload.img_url else None)

    await db.commit()

    await apply_item_ownership(
        db,
        owner_id=obj.id,
        owner_type=models.OwnerTypeEnum.npc,
        scenario_id=obj.scenario_id,
        owned_items=payload.owned_items,
    )
    await db.commit()

    npc = await _get_npc_or_404(db, obj.id, scenario.id)
    await notify_active_sessions_for_scenario(db, scenario, ["npcs"])
    return NPCUpsertResult(**result.model_dump(), npc=npc)


@router.delete("/{npc_id}", response_model=dict)
async def delete_npc(
    npc_id: UUID,
    scenario: models.Scenario = Depends(get_scenario_edit),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    # Зависимости роутов проверяют права на сценарий из запроса, а не на
    # сущность. Без фильтра по scenario_id мастер сценария A правил бы
    # сущность сценария B, подставив свой scenario_id и чужой id.
    obj = (await db.execute(
        select(models.NPC).where(
            models.NPC.id == npc_id,
            models.NPC.scenario_id == scenario.id,
        )
    )).scalars().first()
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="NPC не найден")

    from app.services.entity_lineage_service import assert_launched_entity_deletable

    try:
        assert_launched_entity_deletable(scenario, obj)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    await db.delete(obj)
    await db.commit()
    await notify_active_sessions_for_scenario(db, scenario, ["npcs"])
    return {"ok": True}
