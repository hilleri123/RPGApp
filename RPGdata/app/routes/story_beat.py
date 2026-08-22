from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Form, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import insert, select
from sqlalchemy.orm import selectinload

from app.infrastructure import s3_service
from app.infrastructure.database import get_async_session as get_db
from app.auth import require_master
from app import models, scheme
from app.scheme.common import dump_entity_fields
from plugins.common.types.validation import PluginPayload
from ._helpers import (
        get_scenario_or_404,
        get_scenario_edit,
        load_locations,
        load_npcs,
        sync_scene_exposures,
        notify_active_sessions_for_scenario,
)

router = APIRouter(prefix="/scenarios/{scenario_id}/story_beats", tags=["story_beats"])


def _opts_scene_exposure_preview():
    return (
        selectinload(models.SceneExposure.npcs),
        selectinload(models.SceneExposure.items),
        selectinload(models.SceneExposure.template_npc_links).selectinload(
            models.SceneExposureTemplateNPC.template_npc
        ),
        selectinload(models.SceneExposure.template_item_links),
        selectinload(models.SceneExposure.obstacles),
        selectinload(models.SceneExposure.audio_tracks),
    )


def _stmt_story_beat_list(scenario_id: UUID, skip: int, limit: int):
    return (
        select(models.StoryBeat)
        .where(models.StoryBeat.scenario_id == scenario_id)
        .options(
            selectinload(models.StoryBeat.scene_exposures).options(*_opts_scene_exposure_preview()),
        )
        .order_by(models.StoryBeat.order_num.asc())
        .offset(skip)
        .limit(limit)
    )


def _stmt_story_beat_full(story_beat_id: UUID, scenario_id: UUID):
    return (
        select(models.StoryBeat)
        .where(
            models.StoryBeat.id == story_beat_id,
            models.StoryBeat.scenario_id == scenario_id,
        )
        .options(
            selectinload(models.StoryBeat.locations),
            selectinload(models.StoryBeat.npcs),

            # правильная вложенность: сначала relation с StoryBeat,
            # внутри — selectinload по атрибутам SceneExposure
            selectinload(models.StoryBeat.scene_exposures).options(
                selectinload(models.SceneExposure.npcs),
                selectinload(models.SceneExposure.items)
                    .selectinload(models.GameItem.ownership_link)
                    .selectinload(models.ItemOwnership.character),
                selectinload(models.SceneExposure.template_npc_links)
                    .selectinload(models.SceneExposureTemplateNPC.template_npc),
                selectinload(models.SceneExposure.template_item_links)
                    .selectinload(models.SceneExposureTemplateItem.template_item),
                selectinload(models.SceneExposure.obstacles),
                selectinload(models.SceneExposure.audio_tracks)
                    .selectinload(models.SceneExposureAudio.audio_track),
            ),
        )
    )




@router.post("/validate", response_model=scheme.UpsertResult)
async def validate_story_beat(
    payload: scheme.StoryBeatUpsertPayload,
    scenario: models.Scenario = Depends(get_scenario_edit),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    # пока просто эхо
    result = PluginPayload(
        data=payload.data,
        tags=[]
    )
    return scheme.UpsertResult(ok=True, issues=[], result=result, entity=None)


@router.get("", response_model=List[scheme.StoryBeatListOut])
async def get_all(
    skip: int = 0,
    limit: int = 100,
    scenario: models.Scenario = Depends(get_scenario_or_404),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    beats = (await db.execute(_stmt_story_beat_list(scenario.id, skip, limit))).scalars().all()
    return beats


@router.get("/{story_beat_id}", response_model=scheme.StoryBeatOut)
async def get_by_id(
    story_beat_id: UUID,
    scenario: models.Scenario = Depends(get_scenario_or_404),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    obj = (await db.execute(_stmt_story_beat_full(story_beat_id, scenario.id))).scalars().first()
    if not obj:
        raise HTTPException(404, "StoryBeat not found")
    return obj


@router.post("", response_model=scheme.StoryBeatUpsertResult)
async def create(
    data: str = Form(...),
    img_file: Optional[UploadFile] = File(None),
    scenario: models.Scenario = Depends(get_scenario_edit),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    payload = scheme.StoryBeatUpsertPayload.model_validate_json(data)

    res = await validate_story_beat(
            payload=payload,
            current_user=current_user,
            scenario=scenario,
            db=db,
    )
    if (not res.ok) and (not payload.force):
        return res

    narr = dump_entity_fields(
        payload,
        exclude={"scene_exposures", "location_ids", "npc_ids"},
    )

    obj = models.StoryBeat(
            **narr,
            scenario_id=scenario.id,
    )
    db.add(obj)
    await db.commit()
    await db.flush()    # нужен id

    # ВАЛИДАЦИЯ id-шников (опционально, через твои helpers)
    await load_locations(db, scenario.id, payload.location_ids or [])
    await load_npcs(db, scenario.id, payload.npc_ids or [])

    # связи через link-таблицы, без obj.locations
    if payload.location_ids:
        values = [
            {"story_beat_id": obj.id, "location_id": loc_id}
            for loc_id in payload.location_ids
        ]
        await db.execute(insert(models.story_beat_location).values(values))

    if payload.npc_ids:
        values = [
            {"story_beat_id": obj.id, "npc_id": npc_id}
            for npc_id in payload.npc_ids
        ]
        await db.execute(insert(models.story_beat_npc).values(values))
        
    # файл / url
    if img_file:
        obj.img_url = await s3_service.upload_file(img_file, "story_beat/img", str(obj.id))
    else:
        obj.img_url = str(payload.img_url) if payload.img_url else None

    await db.commit()
    await db.refresh(obj)

    await sync_scene_exposures(
            db,
            story_beat_id=obj.id,
            scenario_id=scenario.id,
            payload_exposures=payload.scene_exposures,
    )
    await db.commit()

    story_beat = await get_by_id(obj.id, scenario, current_user, db)
    await notify_active_sessions_for_scenario(db, scenario, ["story_beats"])
    return scheme.StoryBeatUpsertResult(**res.model_dump(), story_beat=story_beat)


@router.put("/{story_beat_id}", response_model=scheme.StoryBeatUpsertResult)
async def update(
    story_beat_id: UUID,
    data: str = Form(...),
    img_file: Optional[UploadFile] = File(None),
    scenario: models.Scenario = Depends(get_scenario_edit),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    obj = (await db.execute(_stmt_story_beat_full(story_beat_id, scenario.id))).scalars().first()
    if not obj:
        raise HTTPException(404, "StoryBeat not found")

    payload = scheme.StoryBeatUpsertPayload.model_validate_json(data)

    res = await validate_story_beat(
            payload=payload,
            current_user=current_user,
            scenario=scenario,
            db=db,
    )
    if (not res.ok) and (not payload.force):
        return res

    upd = dump_entity_fields(
        payload,
        exclude={"scene_exposures", "location_ids", "npc_ids"},
        exclude_unset=True,
        exclude_none=True,
    )

    for k, v in upd.items():
        setattr(obj, k, v)

    # ВАЛИДАЦИЯ id-шников (опционально, через твои helpers)
    await load_locations(db, scenario.id, payload.location_ids or [])
    await load_npcs(db, scenario.id, payload.npc_ids or [])

    # связи через link-таблицы, без obj.locations
    if payload.location_ids:
        values = [
            {"story_beat_id": obj.id, "location_id": loc_id}
            for loc_id in payload.location_ids
        ]
        await db.execute(insert(models.story_beat_location).values(values))

    if payload.npc_ids:
        values = [
            {"story_beat_id": obj.id, "npc_id": npc_id}
            for npc_id in payload.npc_ids
        ]
        await db.execute(insert(models.story_beat_npc).values(values))
        
    if img_file:
        obj.img_url = await s3_service.upload_file(img_file, "story_beat/img", str(obj.id))
    else:
        obj.img_url = str(payload.img_url) if payload.img_url else obj.img_url

    await db.commit()

    await sync_scene_exposures(
            db,
            story_beat_id=obj.id,
            scenario_id=scenario.id,
            payload_exposures=payload.scene_exposures,
    )
    await db.commit()

    story_beat = await get_by_id(obj.id, scenario, current_user, db)
    await notify_active_sessions_for_scenario(db, scenario, ["story_beats"])
    return scheme.StoryBeatUpsertResult(**res.model_dump(), story_beat=story_beat)


@router.delete("/{story_beat_id}", response_model=dict)
async def delete_story_beat(
    story_beat_id: UUID,
    scenario: models.Scenario = Depends(get_scenario_edit),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    # Зависимости роутов проверяют права на сценарий из запроса, а не на
    # сущность. Без фильтра по scenario_id мастер сценария A правил бы
    # сущность сценария B, подставив свой scenario_id и чужой id.
    obj = (await db.execute(select(models.StoryBeat).where(
        models.StoryBeat.id == story_beat_id,
        models.StoryBeat.scenario_id == scenario.id,
    ))).scalars().first()
    if not obj:
        raise HTTPException(404, "StoryBeat not found")

    from app.services.entity_lineage_service import assert_launched_entity_deletable

    try:
        assert_launched_entity_deletable(scenario, obj)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    await db.delete(obj)
    await db.commit()
    await notify_active_sessions_for_scenario(db, scenario, ["story_beats"])
    return {"ok": True}
