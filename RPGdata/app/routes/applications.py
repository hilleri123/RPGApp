"""
app/routes/applications.py — игрок
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.plugins.contracts import EntityPayload
from app.routes._helpers import validate_entity_data

from app.auth import get_current_user
from app import models
from app.infrastructure.database import get_async_session as get_db
from app.infrastructure import s3_service
from app.scheme import application as scheme
from pydantic import BaseModel

from app.services.application_entity_service import (
    create_player_character_for_application,
    next_photo_url,
    propagate_character_photos,
    sync_application_character_from_application,
)
from app.services.application_reviewer import require_master_reviewer

router = APIRouter(prefix="/applications", tags=["applications"])


# ── helpers ───────────────────────────────────────────────────────────────────

def _stmt_full(application_id: UUID):
    return (
        select(models.CharacterApplication)
        .where(models.CharacterApplication.id == application_id)
        .options(
            selectinload(models.CharacterApplication.reviewer),
            selectinload(models.CharacterApplication.reviews)
            .selectinload(models.ApplicationReview.author),
            selectinload(models.CharacterApplication.item_requests)
            .selectinload(models.ApplicationItemRequest.requested_item),
            selectinload(models.CharacterApplication.item_requests)
            .selectinload(models.ApplicationItemRequest.decided_by),
            selectinload(models.CharacterApplication.granted_items)
            .selectinload(models.CharacterApplicationItem.item),
            selectinload(models.CharacterApplication.player_character)
            .selectinload(models.PlayerCharacter.owned_item_links)
            .selectinload(models.ItemOwnership.item),
        )
    )


async def _own_or_404(
    db: AsyncSession, application_id: UUID, user_id: UUID
) -> models.CharacterApplication:
    obj = (
        await db.execute(
            _stmt_full(application_id).where(
                models.CharacterApplication.user_id == user_id
            )
        )
    ).scalars().first()
    if not obj:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    return obj


# ── endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=List[scheme.ApplicationListOut])
async def list_applications(
    rule_id_str: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 50,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(models.CharacterApplication)
        .where(models.CharacterApplication.user_id == current_user.id)
        .options(selectinload(models.CharacterApplication.reviewer))
        .order_by(models.CharacterApplication.updated_at.desc())
        .offset(skip).limit(limit)
    )
    if rule_id_str:
        stmt = stmt.where(models.CharacterApplication.rule_id_str == rule_id_str)
    return (await db.execute(stmt)).scalars().all()


@router.get("/reviewers", response_model=List[scheme.AuthorOut])
async def list_reviewers(
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = await db.execute(
        select(models.User)
        .where(
            models.User.can_be_master.is_(True),
            models.User.is_active.is_(True),
        )
        .order_by(models.User.full_name)
        .limit(100)
    )
    return rows.scalars().all()


@router.get("/{application_id}", response_model=scheme.ApplicationOut)
async def get_application(
    application_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _own_or_404(db, application_id, current_user.id)


@router.post("", response_model=scheme.ApplicationOut, status_code=201)
async def create_application(
    payload: scheme.ApplicationCreatePayload,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    reviewer_id = await require_master_reviewer(db, payload.reviewer_id)
    obj = models.CharacterApplication(
        user_id=current_user.id,
        reviewer_id=reviewer_id,
        rule_id_str=payload.rule_id_str,
        name=payload.name,
        short_desc=payload.short_desc,
        story=payload.story,
        tags=payload.tags,
        data=payload.data or {},
        player_comment=payload.player_comment,
        status=models.ApplicationStatus.draft,
    )
    db.add(obj)
    await db.flush()
    await create_player_character_for_application(db, obj)
    await db.commit()
    await db.refresh(obj)
    return await _own_or_404(db, obj.id, current_user.id)


@router.put("/{application_id}", response_model=scheme.ApplicationOut)
async def update_application(
    application_id: UUID,
    data: str = Form(...),
    icon_file: Optional[UploadFile] = File(None),
    img_file: Optional[UploadFile] = File(None),
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    obj = await _own_or_404(db, application_id, current_user.id)
    if obj.status not in (
        models.ApplicationStatus.draft,
        models.ApplicationStatus.needs_changes,
    ):
        raise HTTPException(400, detail=f"Нельзя редактировать заявку в статусе «{obj.status}»")

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
    await propagate_character_photos(
        db,
        icon_url=str(obj.icon_url) if obj.icon_url else None,
        img_url=str(obj.img_url) if obj.img_url else None,
        source_character_id=obj.player_character_id,
        application=obj,
    )
    return await _own_or_404(db, obj.id, current_user.id)


class _PhotosPayload(BaseModel):
    icon_url: Optional[str] = None
    img_url: Optional[str] = None
    clear_icon: bool = False
    clear_img: bool = False


async def _stored_photos(
    owner_id: str,
    current_icon: str | None,
    current_img: str | None,
    payload: _PhotosPayload,
    icon_file: UploadFile | None,
    img_file: UploadFile | None,
) -> tuple[str | None, str | None]:
    uploaded_icon = (
        await s3_service.upload_file(icon_file, "application/icon", owner_id) if icon_file else None
    )
    uploaded_img = (
        await s3_service.upload_file(img_file, "application/img", owner_id) if img_file else None
    )
    return (
        next_photo_url(
            current=current_icon,
            uploaded=uploaded_icon,
            url=str(payload.icon_url) if payload.icon_url else None,
            clear=payload.clear_icon,
        ),
        next_photo_url(
            current=current_img,
            uploaded=uploaded_img,
            url=str(payload.img_url) if payload.img_url else None,
            clear=payload.clear_img,
        ),
    )


@router.put("/by-character/{character_id}/photos")
async def update_photos_by_character(
    character_id: UUID,
    data: str = Form("{}"),
    icon_file: Optional[UploadFile] = File(None),
    img_file: Optional[UploadFile] = File(None),
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Иконка и портрет своего персонажа, в том числе после одобрения заявки."""
    character = await db.get(models.PlayerCharacter, character_id)
    if character is None:
        raise HTTPException(404, detail="Персонаж не найден")

    source_ids = [
        value
        for value in (character.id, character.source_entity_id, character.copied_from)
        if value is not None
    ]
    application = (
        await db.execute(
            select(models.CharacterApplication).where(
                models.CharacterApplication.user_id == current_user.id,
                models.CharacterApplication.player_character_id.in_(source_ids),
            )
        )
    ).scalars().first()
    if application is None and character.bound_user_id != current_user.id:
        raise HTTPException(403, detail="Менять фото можно только у своего персонажа")

    payload = _PhotosPayload.model_validate_json(data or "{}")
    owner_id = str(application.id if application is not None else character.id)
    current_icon = str(application.icon_url) if application and application.icon_url else (
        str(character.icon_url) if character.icon_url else None
    )
    current_img = str(application.img_url) if application and application.img_url else (
        str(character.img_url) if character.img_url else None
    )
    icon_url, img_url = await _stored_photos(owner_id, current_icon, current_img, payload, icon_file, img_file)
    source_id = (
        application.player_character_id
        if application is not None and application.player_character_id
        else (character.source_entity_id or character.id)
    )
    if application is not None:
        application.updated_at = datetime.now(timezone.utc)
    await propagate_character_photos(
        db,
        icon_url=icon_url,
        img_url=img_url,
        source_character_id=source_id,
        application=application,
    )
    return {"icon_url": icon_url, "img_url": img_url}


@router.put("/{application_id}/photos", response_model=scheme.ApplicationOut)
async def update_application_photos(
    application_id: UUID,
    data: str = Form("{}"),
    icon_file: Optional[UploadFile] = File(None),
    img_file: Optional[UploadFile] = File(None),
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Только иконка и портрет. Статус заявки не мешает, в том числе «approved»."""
    obj = await _own_or_404(db, application_id, current_user.id)
    payload = _PhotosPayload.model_validate_json(data or "{}")
    icon_url, img_url = await _stored_photos(
        str(obj.id),
        str(obj.icon_url) if obj.icon_url else None,
        str(obj.img_url) if obj.img_url else None,
        payload,
        icon_file,
        img_file,
    )
    obj.updated_at = datetime.now(timezone.utc)
    await propagate_character_photos(
        db,
        icon_url=icon_url,
        img_url=img_url,
        source_character_id=obj.player_character_id,
        application=obj,
    )
    return await _own_or_404(db, obj.id, current_user.id)


@router.post("/{application_id}/submit", response_model=scheme.ApplicationOut)
async def submit_application(
    application_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    obj = await _own_or_404(db, application_id, current_user.id)
    if obj.status not in (
        models.ApplicationStatus.draft,
        models.ApplicationStatus.needs_changes,
    ):
        raise HTTPException(400, detail=f"Нельзя отправить заявку в статусе «{obj.status}»")
    obj.status = models.ApplicationStatus.submitted
    obj.submitted_at = datetime.now(timezone.utc)
    obj.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return await _own_or_404(db, obj.id, current_user.id)


@router.post("/{application_id}/withdraw", response_model=scheme.ApplicationOut)
async def withdraw_application(
    application_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    obj = await _own_or_404(db, application_id, current_user.id)
    if obj.status != models.ApplicationStatus.submitted:
        raise HTTPException(400, detail="Отозвать можно только заявку в статусе «submitted»")
    obj.status = models.ApplicationStatus.draft
    obj.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return await _own_or_404(db, obj.id, current_user.id)


@router.delete("/{application_id}", status_code=204)
async def delete_application(
    application_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    obj = await _own_or_404(db, application_id, current_user.id)
    if obj.status not in (
        models.ApplicationStatus.draft,
        models.ApplicationStatus.rejected,
    ):
        raise HTTPException(400, detail="Удалить можно только черновик или отклонённую заявку")
    await db.delete(obj)
    await db.commit()


@router.post("/{application_id}/reviews", response_model=scheme.ReviewOut, status_code=201)
async def add_player_review(
    application_id: UUID,
    payload: scheme.PlayerReviewPayload,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    obj = await _own_or_404(db, application_id, current_user.id)
    if obj.status != models.ApplicationStatus.needs_changes:
        raise HTTPException(400, detail="Ответить можно только при статусе «needs_changes»")
    review = models.ApplicationReview(
        application_id=obj.id,
        author_id=current_user.id,
        status_set_to=obj.status,
        comment=payload.comment,
        is_player_note=True,
    )
    db.add(review)
    obj.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(review)
    return review


@router.post("/{application_id}/item-requests", response_model=scheme.ItemRequestOut, status_code=201)
async def create_item_request(
    application_id: UUID,
    payload: scheme.ItemRequestCreatePayload,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    obj = await _own_or_404(db, application_id, current_user.id)
    if obj.status not in (
        models.ApplicationStatus.draft,
        models.ApplicationStatus.needs_changes,
    ):
        raise HTTPException(400, detail="Нельзя добавить пожелание в текущем статусе")
    req = models.ApplicationItemRequest(
        application_id=obj.id,
        requested_item_id=payload.requested_item_id,
        requested_name=payload.requested_name,
        player_comment=payload.player_comment,
    )
    db.add(req)
    obj.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(req)
    return req


@router.put("/{application_id}/item-requests/{request_id}", response_model=scheme.ItemRequestOut)
async def update_item_request(
    application_id: UUID,
    request_id: UUID,
    payload: scheme.ItemRequestUpdatePayload,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _own_or_404(db, application_id, current_user.id)
    req = (await db.execute(
        select(models.ApplicationItemRequest).where(
            models.ApplicationItemRequest.id == request_id,
            models.ApplicationItemRequest.application_id == application_id,
        )
    )).scalars().first()
    if not req:
        raise HTTPException(404, detail="Пожелание не найдено")
    for k, v in payload.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(req, k, v)
    await db.commit()
    await db.refresh(req)
    return req


@router.delete("/{application_id}/item-requests/{request_id}", status_code=204)
async def delete_item_request(
    application_id: UUID,
    request_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    obj = await _own_or_404(db, application_id, current_user.id)
    if obj.status not in (
        models.ApplicationStatus.draft,
        models.ApplicationStatus.needs_changes,
    ):
        raise HTTPException(400, detail="Нельзя удалить пожелание в текущем статусе")
    req = (await db.execute(
        select(models.ApplicationItemRequest).where(
            models.ApplicationItemRequest.id == request_id,
            models.ApplicationItemRequest.application_id == application_id,
        )
    )).scalars().first()
    if not req:
        raise HTTPException(404, detail="Пожелание не найдено")
    await db.delete(req)
    obj.updated_at = datetime.now(timezone.utc)
    await db.commit()



@router.post("/validate", response_model=scheme.ValidateResult)
async def validate_application_data(
    payload: scheme.ApplicationValidatePayload,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Валидация данных персонажа по правилам системы.
    Не создаёт заявку — только проверяет data/tags через плагин.
    """
    result = await validate_entity_data(
        db=db,
        entity="character",
        payload=EntityPayload(
            data=payload.data or {},
            tags=payload.tags or [],
        ),
        rule_id_str=payload.rule_id_str,
    )
    return scheme.ValidateResult(**result.model_dump())
