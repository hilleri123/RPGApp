from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import require_master
from app import models
from app.infrastructure.database import get_async_session as get_db
from app.infrastructure import s3_service
from app.scheme import application as scheme
from app.services.application_entity_service import (
    grant_item_to_application_character,
    sync_application_character_from_application,
)
from app.plugins.contracts import EntityPayload
from app.routes._helpers import validate_entity_data


router = APIRouter(prefix="/master/applications", tags=["master-applications"])


# ── helpers ───────────────────────────────────────────────────────────────────


def _stmt_full(application_id: UUID):
    return (
        select(models.CharacterApplication)
        .where(models.CharacterApplication.id == application_id)
        .options(
            selectinload(models.CharacterApplication.user),
            selectinload(models.CharacterApplication.reviews)
            .selectinload(models.ApplicationReview.author),
            selectinload(models.CharacterApplication.item_requests)
            .selectinload(models.ApplicationItemRequest.requested_item),
            selectinload(models.CharacterApplication.item_requests)
            .selectinload(models.ApplicationItemRequest.decided_by),
            selectinload(models.CharacterApplication.granted_items)
            .selectinload(models.CharacterApplicationItem.item),
            selectinload(models.CharacterApplication.granted_items)
            .selectinload(models.CharacterApplicationItem.granted_by),
            selectinload(models.CharacterApplication.player_character)
            .selectinload(models.PlayerCharacter.owned_item_links)
            .selectinload(models.ItemOwnership.item),
        )
    )


async def _get_or_404(
    db: AsyncSession, application_id: UUID
) -> models.CharacterApplication:
    obj = (await db.execute(_stmt_full(application_id))).scalars().first()
    if not obj:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    return obj


# ── list / get ────────────────────────────────────────────────────────────────


@router.get("", response_model=List[scheme.ApplicationListOut])
async def master_list_applications(
    status: Optional[str] = Query(None),
    rule_id_str: Optional[str] = Query(None),
    user_id: Optional[UUID] = Query(None),
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(models.CharacterApplication)
        .options(selectinload(models.CharacterApplication.user))
        .order_by(models.CharacterApplication.updated_at.desc())
        .offset(skip).limit(limit)
    )
    if status:
        try:
            stmt = stmt.where(
                models.CharacterApplication.status == models.ApplicationStatus(status)
            )
        except ValueError:
            raise HTTPException(400, detail=f"Неизвестный статус: {status}")
    if rule_id_str:
        stmt = stmt.where(models.CharacterApplication.rule_id_str == rule_id_str)
    if user_id:
        stmt = stmt.where(models.CharacterApplication.user_id == user_id)

    return (await db.execute(stmt)).scalars().all()


@router.get("/{application_id}", response_model=scheme.ApplicationOut)
async def master_get_application(
    application_id: UUID,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    return await _get_or_404(db, application_id)


# ── review (смена статуса + комментарий) ─────────────────────────────────────


@router.post("/{application_id}/review", response_model=scheme.ApplicationOut)
async def master_review(
    application_id: UUID,
    payload: scheme.MasterReviewPayload,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    obj = await _get_or_404(db, application_id)

    # допустимые переходы
    ALLOWED: dict[models.ApplicationStatus, list[models.ApplicationStatus]] = {
        models.ApplicationStatus.submitted:     [models.ApplicationStatus.in_review,
                                                 models.ApplicationStatus.needs_changes,
                                                 models.ApplicationStatus.approved,
                                                 models.ApplicationStatus.rejected],
        models.ApplicationStatus.in_review:     [models.ApplicationStatus.needs_changes,
                                                 models.ApplicationStatus.approved,
                                                 models.ApplicationStatus.rejected],
        models.ApplicationStatus.needs_changes: [models.ApplicationStatus.in_review,
                                                 models.ApplicationStatus.approved,
                                                 models.ApplicationStatus.rejected],
    }
    new_status = models.ApplicationStatus(payload.new_status)
    allowed = ALLOWED.get(obj.status, [])
    if new_status not in allowed:
        raise HTTPException(
            400,
            detail=f"Переход «{obj.status}» → «{new_status}» недопустим",
        )

    review = models.ApplicationReview(
        application_id=obj.id,
        author_id=current_user.id,
        status_set_to=new_status,
        comment=payload.comment,
        proposed_data=payload.proposed_data,
        is_player_note=False,
    )
    db.add(review)

    obj.status = new_status
    obj.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return await _get_or_404(db, obj.id)


# ── редактирование персонажа мастером ─────────────────────────────────────────


@router.put("/{application_id}", response_model=scheme.ApplicationOut)
async def master_update_application(
    application_id: UUID,
    data: str = Form(...),
    icon_file: Optional[UploadFile] = File(None),
    img_file: Optional[UploadFile] = File(None),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    """Мастер может редактировать содержимое заявки в любом статусе."""
    obj = await _get_or_404(db, application_id)

    payload = scheme.ApplicationUpdatePayload.model_validate_json(data)
    for k, v in payload.model_dump(exclude_unset=True, exclude_none=True, mode="json").items():
        if k not in ("icon_url", "img_url"):
            setattr(obj, k, v)

    if icon_file:
        obj.icon_url = await s3_service.upload_file(icon_file, "application/icon", str(obj.id))
    elif payload.icon_url:
        obj.icon_url = str(payload.icon_url)

    if img_file:
        obj.img_url = await s3_service.upload_file(img_file, "application/img", str(obj.id))
    elif payload.img_url:
        obj.img_url = str(payload.img_url)

    obj.updated_at = datetime.now(timezone.utc)
    await sync_application_character_from_application(db, obj)
    await db.commit()
    return await _get_or_404(db, obj.id)


@router.post("/validate", response_model=scheme.ValidateResult)
async def master_validate(
    payload: scheme.ApplicationValidatePayload,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    result = await validate_entity_data(
        db=db,
        entity="character",
        payload=EntityPayload(data=payload.data or {}, tags=payload.tags or []),
        rule_id_str=payload.rule_id_str,
    )
    return scheme.ValidateResult(**result.model_dump())


# ── item-requests: решение мастера ────────────────────────────────────────────


@router.post(
    "/{application_id}/decide-item-request/{request_id}",
    response_model=scheme.ItemRequestOut,
)
async def decide_item_request(
    application_id: UUID,
    request_id: UUID,
    payload: scheme.ItemRequestDecisionPayload,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    await _get_or_404(db, application_id)
    req = (await db.execute(
        select(models.ApplicationItemRequest).where(
            models.ApplicationItemRequest.id == request_id,
            models.ApplicationItemRequest.application_id == application_id,
        )
    )).scalars().first()
    if not req:
        raise HTTPException(404, detail="Пожелание не найдено")

    req.status = models.ItemRequestStatus(payload.status)
    req.master_comment = payload.master_comment
    req.decided_at = datetime.now(timezone.utc)
    req.decided_by_id = current_user.id
    await db.commit()
    await db.refresh(req)
    return req


# ── granted_items: мастер выдаёт предмет вручную ─────────────────────────────


@router.post(
    "/{application_id}/grant-item",
    response_model=scheme.GrantedItemOut,
    status_code=201,
)
async def grant_item(
    application_id: UUID,
    payload: scheme.GrantItemPayload,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    obj = await _get_or_404(db, application_id)
    link = await grant_item_to_application_character(
        db,
        obj,
        item_id=payload.item_id,
        master_id=current_user.id,
        master_comment=payload.master_comment,
    )
    granted = models.CharacterApplicationItem(
        application_id=application_id,
        item_id=link.item_id,
        item_request_id=payload.item_request_id,
        master_comment=payload.master_comment,
        granted_by_id=current_user.id,
    )
    db.add(granted)
    await db.commit()
    await db.refresh(granted)
    return granted


@router.delete("/{application_id}/grant-item/{granted_item_id}", status_code=204)
async def revoke_item(
    application_id: UUID,
    granted_item_id: UUID,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    obj = (await db.execute(
        select(models.CharacterApplicationItem).where(
            models.CharacterApplicationItem.id == granted_item_id,
            models.CharacterApplicationItem.application_id == application_id,
        )
    )).scalars().first()
    if not obj:
        raise HTTPException(404, detail="Выданный предмет не найден")
    await db.delete(obj)
    await db.commit()


# ── approve-and-create: финальное одобрение → создать персонажа ───────────────


@router.post("/{application_id}/approve-and-create", response_model=scheme.ApplicationOut)
async def approve_and_create(
    application_id: UUID,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    """
    Финальное одобрение: статус → approved, пишем review.
    Логику создания PlayerCharacter из заявки добавь здесь.
    """
    obj = await _get_or_404(db, application_id)
    if obj.status == models.ApplicationStatus.approved:
        raise HTTPException(400, detail="Заявка уже одобрена")
    if obj.status == models.ApplicationStatus.rejected:
        raise HTTPException(400, detail="Отклонённую заявку нельзя одобрить")

    review = models.ApplicationReview(
        application_id=obj.id,
        author_id=current_user.id,
        status_set_to=models.ApplicationStatus.approved,
        comment="Заявка одобрена. Персонаж создан.",
        is_player_note=False,
    )
    db.add(review)
    obj.status = models.ApplicationStatus.approved
    obj.updated_at = datetime.now(timezone.utc)

    await sync_application_character_from_application(db, obj)
    for granted in list(obj.granted_items or []):
        try:
            await grant_item_to_application_character(
                db,
                obj,
                item_id=granted.item_id,
                master_id=current_user.id,
                master_comment=granted.master_comment,
            )
        except ValueError:
            continue

    await db.commit()
    return await _get_or_404(db, obj.id)
