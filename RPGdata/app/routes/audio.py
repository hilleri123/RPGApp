from __future__ import annotations

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import or_, select, cast, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.user import get_current_user
from app.infrastructure.database import get_async_session as get_db
from app.infrastructure.s3_service import delete_file, is_audio_file, upload_file
from app import models
from app import scheme

router = APIRouter(prefix="/audio", tags=["audio"])

# ── CRUD треков ────────────────────────────────────────────────────────────────


@router.get("", response_model=List[scheme.AudioTrackOut])
async def list_tracks(
    search: Optional[str] = Query(None, description="Поиск по имени / описанию"),
    tag: Optional[str] = Query(None, description="Фильтр по тегу"),
    limit: int = Query(50, ge=0),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    q = select(models.AudioTrack).order_by(models.AudioTrack.created_at.desc())

    if search:
        like = f"%{search}%"
        q = q.where(
            or_(
                models.AudioTrack.name.ilike(like),
                models.AudioTrack.description.ilike(like),
                cast(models.AudioTrack.tags, String).ilike(like),
            )
        )
    if tag:
        # tags хранится как JSON-массив строк
        q = q.where(cast(models.AudioTrack.tags, JSONB).contains([tag]))

    q = q.limit(limit).offset(offset)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/{track_id}", response_model=scheme.AudioTrackOut)
async def get_track(
    track_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    track = await db.get(models.AudioTrack, track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    return track


@router.post("", response_model=scheme.AudioTrackOut, status_code=status.HTTP_201_CREATED)
async def upload_track(
    file: UploadFile = File(...),
    name: Optional[str] = Query(None),
    description: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not is_audio_file(file.content_type, file.filename):
        raise HTTPException(status_code=400, detail="File must be an audio file")

    track_id = uuid.uuid4()
    url = await upload_file(file, "audio", str(track_id))

    # размер: считываем после upload_file (файл уже записан)
    # file.size может быть None у некоторых клиентов — поэтому опционально
    track = models.AudioTrack(
        id=track_id,
        name=name or (file.filename or "untitled"),
        description=description,
        url=url,
        mime_type=file.content_type,
        file_size=file.size,
        created_by=current_user.id,
    )
    db.add(track)
    await db.commit()
    await db.refresh(track)
    return track


@router.patch("/{track_id}", response_model=scheme.AudioTrackOut)
async def update_track(
    track_id: uuid.UUID,
    body: scheme.AudioTrackUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    track = await db.get(models.AudioTrack, track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    if body.name is not None:
        track.name = body.name
    if body.description is not None:
        track.description = body.description
    if body.tags is not None:
        track.tags = body.tags

    await db.commit()
    await db.refresh(track)
    return track


@router.delete("/{track_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_track(
    track_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    track = await db.get(models.AudioTrack, track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    delete_file(track.url)
    await db.delete(track)
    await db.commit()


# ── Привязка треков к экспозиции ───────────────────────────────────────────────


@router.get("/exposure/{exposure_id}", response_model=List[scheme.ExposureAudioLinkOut])
async def get_exposure_audio(
    exposure_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    q = (
        select(models.SceneExposureAudio)
        .where(models.SceneExposureAudio.scene_exposure_id == exposure_id)
        .order_by(models.SceneExposureAudio.order_num)
    )
    result = await db.execute(q)
    return result.scalars().all()


@router.post(
    "/exposure/{exposure_id}",
    response_model=scheme.ExposureAudioLinkOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_audio_to_exposure(
    exposure_id: uuid.UUID,
    body: scheme.ExposureAudioLinkIn,
    db: AsyncSession = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    # проверяем что трек существует
    track = await db.get(models.AudioTrack, body.audio_track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    # upsert: если уже есть — обновляем настройки
    existing = await db.get(
        models.SceneExposureAudio, (exposure_id, body.audio_track_id)
    )
    if existing:
        existing.volume    = body.volume
        existing.loop      = body.loop
        existing.fade_in   = body.fade_in
        existing.fade_out  = body.fade_out
        existing.order_num = body.order_num
        await db.commit()
        await db.refresh(existing)
        return existing

    link = models.SceneExposureAudio(
        scene_exposure_id=exposure_id,
        audio_track_id=body.audio_track_id,
        volume=body.volume,
        loop=body.loop,
        fade_in=body.fade_in,
        fade_out=body.fade_out,
        order_num=body.order_num,
    )
    db.add(link)
    await db.commit()
    await db.refresh(link)
    return link


@router.patch("/exposure/{exposure_id}/{track_id}", response_model=scheme.ExposureAudioLinkOut)
async def update_exposure_audio(
    exposure_id: uuid.UUID,
    track_id: uuid.UUID,
    body: scheme.ExposureAudioLinkIn,
    db: AsyncSession = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    link = await db.get(models.SceneExposureAudio, (exposure_id, track_id))
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")

    link.volume    = body.volume
    link.loop      = body.loop
    link.fade_in   = body.fade_in
    link.fade_out  = body.fade_out
    link.order_num = body.order_num
    await db.commit()
    await db.refresh(link)
    return link


@router.delete(
    "/exposure/{exposure_id}/{track_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_audio_from_exposure(
    exposure_id: uuid.UUID,
    track_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    link = await db.get(models.SceneExposureAudio, (exposure_id, track_id))
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    await db.delete(link)
    await db.commit()