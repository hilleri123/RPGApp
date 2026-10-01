from __future__ import annotations

from typing import List, Optional, Set
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload

from app.infrastructure.database import get_async_session as get_db
from app.infrastructure import s3_service
from app.auth import require_master
from app import models, scheme
from app.plugins.contracts import EntityPayload
from app.scheme.common import dump_entity_fields
from app.scheme.location import LocationUpsertPayload, LocationUpsertResult
from app.constants.location_kinds import (
    allowed_child_kinds,
    canonical_kind,
    kind_of,
    with_kind,
)
from ._helpers import get_scenario_or_404, get_scenario_edit, validate_entity_data, sync_scene_exposures, notify_active_sessions_for_scenario


router = APIRouter(prefix="/scenarios/{scenario_id}/locations", tags=["locations"])


async def _set_location_media(
    obj: models.Location,
    *,
    icon_file: Optional[UploadFile],
    map_file: Optional[UploadFile],
    icon_url,
    map_url,
) -> None:
    """Upload icon/map files (URL gets a timestamp via s3_service)."""
    if icon_file:
        obj.icon_url = await s3_service.upload_file(
            icon_file, "location/icon", str(obj.id)
        )
    else:
        obj.icon_url = str(icon_url) if icon_url else None

    if map_file:
        obj.map_url = await s3_service.upload_file(
            map_file, "location/map", str(obj.id)
        )
    else:
        obj.map_url = str(map_url) if map_url else None


# ---------------------------------------------------------------------------
# Внутренние утилиты
# ---------------------------------------------------------------------------

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


def _stmt_location_list(scenario_id: UUID, skip: int, limit: int):
    return (
        select(models.Location)
        .where(models.Location.scenario_id == scenario_id)
        .options(
            selectinload(models.Location.parent_location),
            selectinload(models.Location.scene_exposures).options(*_opts_scene_exposure_preview()),
        )
        .offset(skip)
        .limit(limit)
        .order_by(models.Location.name.asc())
    )


def _stmt_location_full():
    return (
        select(models.Location)
        .options(
            selectinload(models.Location.parent_location),
            selectinload(models.Location.map_objects),
            selectinload(models.Location.scene_exposures).options(
                selectinload(models.SceneExposure.npcs),
                selectinload(models.SceneExposure.obstacles),

                # template_npcs через link-таблицу
                selectinload(models.SceneExposure.template_npc_links)
                    .selectinload(models.SceneExposureTemplateNPC.template_npc),

                # template_items через link-таблицу
                selectinload(models.SceneExposure.template_item_links)
                    .selectinload(models.SceneExposureTemplateItem.template_item),

                # items с ownership
                selectinload(models.SceneExposure.items)
                    .selectinload(models.GameItem.ownership_link)
                    .selectinload(models.ItemOwnership.character),
                selectinload(models.SceneExposure.items)
                    .selectinload(models.GameItem.ownership_link)
                    .selectinload(models.ItemOwnership.npc),
                selectinload(models.SceneExposure.items)
                    .selectinload(models.GameItem.ownership_link)
                    .selectinload(models.ItemOwnership.owner_item),

                selectinload(models.SceneExposure.audio_tracks)
                    .selectinload(models.SceneExposureAudio.audio_track),
            ),
        )
    )



async def _get_location_or_404(
    db: AsyncSession, location_id: UUID, scenario_id: UUID
) -> scheme.LocationOut:
    obj = (await db.execute(
        _stmt_location_full().where(
            models.Location.id == location_id,
            models.Location.scenario_id == scenario_id,
        )
    )).scalars().first()
    if not obj:
        raise HTTPException(status_code=404, detail="Локация не найдена")
    return scheme.LocationOut.model_validate(obj)


async def _load_location(
    db: AsyncSession, location_id: UUID, scenario_id: UUID
) -> models.Location:
    """Локация строго внутри переданного сценария.

    Зависимости роутов проверяют права на сценарий из запроса, а не на локацию,
    поэтому без фильтра по scenario_id мастер сценария A правил бы локацию
    сценария B, подставив свой scenario_id и чужой location_id.
    """
    obj = (await db.execute(
        select(models.Location).where(
            models.Location.id == location_id,
            models.Location.scenario_id == scenario_id,
        )
    )).scalars().first()
    if not obj:
        raise HTTPException(404, "Локация не найдена")
    return obj


def _make_entity_payload(payload: LocationUpsertPayload) -> EntityPayload:
    """Единственная точка сопряжения LocationUpsertPayload → EntityPayload."""
    return EntityPayload(
        data=payload.model_dump(mode="json")["data"],
        tags=payload.tags or [],
    )


async def _check_sublocation_kinds(
    db: AsyncSession,
    scenario_id: UUID,
    parent_location_id: UUID | None,
    parent_tags: list[str] | None,
    sublocations: list[scheme.SubLocationRef],
) -> None:
    """400, если подлокации назначен неизвестный вид или вид, не допустимый под родителем.

    Проверяются только новые/изменённые виды: старые подлокации, чей вид стал
    недопустимым после смены вида родителя, сохранение не блокируют.
    """
    explicit = [s for s in sublocations if "kind" in s.model_fields_set and s.kind]
    if not explicit:
        return

    unknown = [s for s in explicit if canonical_kind(s.kind) is None]
    if unknown:
        raise HTTPException(
            status_code=400,
            detail=f"Неизвестный вид местности у подлокации «{unknown[0].name}»: {unknown[0].kind}",
        )

    allowed = set(allowed_child_kinds(kind_of(parent_tags)))
    current_kind: dict[UUID, str | None] = {}
    if parent_location_id is not None:
        rows = (await db.execute(
            select(models.Location).where(
                models.Location.parent_location_id == parent_location_id,
                models.Location.scenario_id == scenario_id,
            )
        )).scalars().all()
        current_kind = {loc.id: kind_of(loc.tags) for loc in rows}

    for s in explicit:
        kind = canonical_kind(s.kind)
        if s.id and current_kind.get(s.id) == kind:
            continue
        if kind not in allowed:
            parent_kind = kind_of(parent_tags)
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Подлокации «{s.name}» нельзя назначить вид «{kind}» "
                    f"внутри локации вида «{parent_kind}»"
                ),
            )


async def _sync_sublocations(
    db: AsyncSession,
    scenario_id: UUID,
    parent_location_id: UUID,
    sublocations: list[scheme.SubLocationRef],
) -> None:
    payload_ids = {s.id for s in sublocations if s.id}

    existing = (await db.execute(
        select(models.Location).where(
            models.Location.parent_location_id == parent_location_id,
            models.Location.scenario_id == scenario_id,
        )
    )).scalars().all()

    for loc in existing:
        if loc.id not in payload_ids:
            loc.parent_location_id = None

    existing_by_id = {loc.id: loc for loc in existing}

    def new_tags(s: scheme.SubLocationRef) -> list[str]:
        return with_kind([], s.kind)

    for s in sublocations:
        if s.id:
            loc = existing_by_id.get(s.id)
            if loc:
                loc.name = s.name
                if "kind" in s.model_fields_set:
                    loc.tags = with_kind(loc.tags, s.kind)
            else:
                # есть id из Redis, но в БД ещё нет — создаём с этим id
                new_loc = models.Location(
                    id=s.id,          # <-- вот это было пропущено
                    name=s.name,
                    description_for_master="",
                    description_for_players="",
                    parent_location_id=parent_location_id,
                    scenario_id=scenario_id,
                    tags=new_tags(s),
                )
                db.add(new_loc)
        else:
            # id нет совсем — не должно происходить после наших изменений,
            # но на всякий случай оставляем fallback
            new_loc = models.Location(
                name=s.name,
                description_for_master="",
                description_for_players="",
                parent_location_id=parent_location_id,
                scenario_id=scenario_id,
                tags=new_tags(s),
            )
            db.add(new_loc)



async def _sync_map_objects(
    db: AsyncSession,
    location_id: UUID,
    payload_objects: list[scheme.MapObjectPolygonBase | scheme.MapObjectPolygon],
):
    keep_ids: Set[UUID] = {o.id for o in payload_objects if getattr(o, "id", None)}

    if keep_ids:
        await db.execute(
            delete(models.MapObjectPolygon).where(
                models.MapObjectPolygon.source_location_id == location_id,
                models.MapObjectPolygon.id.notin_(keep_ids),
            )
        )
    else:
        await db.execute(
            delete(models.MapObjectPolygon).where(
                models.MapObjectPolygon.source_location_id == location_id
            )
        )

    for o in payload_objects:
        obj_id = getattr(o, "id", None)
        obj_data = o.model_dump(mode="json")

        if not obj_id:
            obj_data["source_location_id"] = location_id
            db.add(models.MapObjectPolygon(**obj_data))
            continue

        db_obj = (await db.execute(
            select(models.MapObjectPolygon).where(
                models.MapObjectPolygon.id == obj_id,
                models.MapObjectPolygon.source_location_id == location_id,
            )
        )).scalars().first()

        if not db_obj:
            raise HTTPException(400, f"MapObjectPolygon {obj_id} not found for this location")

        for k, v in obj_data.items():
            if k == "id":
                continue
            setattr(db_obj, k, v)


async def _check_parent_location(db: AsyncSession, parent_id: UUID, scenario_id: UUID) -> None:
    parent = (await db.execute(
        select(models.Location).where(
            models.Location.id == parent_id,
            models.Location.scenario_id == scenario_id,
        )
    )).scalars().first()
    if not parent:
        raise HTTPException(404, "Родительская локация не найдена")


# ---------------------------------------------------------------------------
# Эндпоинты
# ---------------------------------------------------------------------------

@router.post("/validate", response_model=scheme.UpsertResult)
async def validate_location(
    payload: LocationUpsertPayload,
    scenario: models.Scenario = Depends(get_scenario_edit),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    result = await validate_entity_data(
        db=db,
        entity="location",
        payload=_make_entity_payload(payload),
        scenario_id=scenario.id,
    )
    return scheme.UpsertResult(**result.model_dump())


@router.get("", response_model=List[scheme.LocationList])
async def get_locations(
    skip: int = 0,
    limit: int = 100,
    scenario: models.Scenario = Depends(get_scenario_or_404),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(_stmt_location_list(scenario.id, skip, limit))).scalars().all()
    return rows


@router.get("/{location_id}", response_model=scheme.LocationOut)
async def get_location(
    location_id: UUID,
    scenario: models.Scenario = Depends(get_scenario_or_404),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    return await _get_location_or_404(db, location_id, scenario.id)


@router.post("", response_model=LocationUpsertResult)
async def create_location(
    data: str = Form(...),
    icon_file: Optional[UploadFile] = File(None),
    map_file: Optional[UploadFile] = File(None),
    scenario: models.Scenario = Depends(get_scenario_edit),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    payload = LocationUpsertPayload.model_validate_json(data)

    result = await validate_entity_data(
        db=db,
        entity="location",
        payload=_make_entity_payload(payload),
        scenario_id=scenario.id,
    )

    if not result.ok and not payload.force:
        return LocationUpsertResult(**result.model_dump(), location=None)

    if payload.parent_location_id:
        await _check_parent_location(db, payload.parent_location_id, scenario.id)
    await _check_sublocation_kinds(
        db, scenario.id, None, result.result.tags or payload.tags, payload.sublocations
    )

    plugin_data = result.result.model_dump(mode="json")
    entity_data = dump_entity_fields(
        payload,
        exclude={"map_objects", "sublocations", "scene_exposures"},
    )
    for k in plugin_data:
        entity_data.pop(k, None)

    obj = models.Location(
        **entity_data,
        **plugin_data,
        scenario_id=scenario.id,
    )

    db.add(obj)
    await db.commit()
    await db.refresh(obj)

    await _set_location_media(
        obj,
        icon_file=icon_file,
        map_file=map_file,
        icon_url=payload.icon_url,
        map_url=payload.map_url,
    )

    await db.commit()

    await _sync_map_objects(db, obj.id, payload.map_objects)
    await _sync_sublocations(db, scenario.id, obj.id, payload.sublocations)
    await sync_scene_exposures(
        db,
        scenario_id=scenario.id,
        location_id=obj.id,
        payload_exposures=payload.scene_exposures,
    )
    await db.commit()

    location = await _get_location_or_404(db, obj.id, scenario.id)
    await notify_active_sessions_for_scenario(db, scenario, ["locations", "scenes"])
    return LocationUpsertResult(**result.model_dump(), location=location)


@router.put("/{location_id}", response_model=LocationUpsertResult)
async def update_location(
    location_id: UUID,
    data: str = Form(...),
    icon_file: Optional[UploadFile] = File(None),
    map_file: Optional[UploadFile] = File(None),
    scenario: models.Scenario = Depends(get_scenario_edit),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    obj = await _load_location(db, location_id, scenario.id)

    payload = LocationUpsertPayload.model_validate_json(data)

    result = await validate_entity_data(
        db=db,
        entity="location",
        payload=_make_entity_payload(payload),
        scenario_id=scenario.id,
    )

    if not result.ok and not payload.force:
        return LocationUpsertResult(**result.model_dump(), location=None)

    if payload.parent_location_id:
        await _check_parent_location(db, payload.parent_location_id, scenario.id)
    await _check_sublocation_kinds(
        db, scenario.id, obj.id, result.result.tags or payload.tags, payload.sublocations
    )

    update_fields = dump_entity_fields(
        payload,
        exclude={"map_objects", "sublocations", "scene_exposures"},
        exclude_unset=True,
        exclude_none=True,
    )
    update_fields["data"] = result.result.data
    update_fields["tags"] = result.result.tags

    for k, v in update_fields.items():
        setattr(obj, k, v)


    await _set_location_media(
        obj,
        icon_file=icon_file,
        map_file=map_file,
        icon_url=payload.icon_url,
        map_url=payload.map_url,
    )

    await db.commit()

    await _sync_map_objects(db, location_id, payload.map_objects)
    await _sync_sublocations(db, scenario.id, obj.id, payload.sublocations)
    await sync_scene_exposures(
        db,
        scenario_id=scenario.id,
        location_id=obj.id,
        payload_exposures=payload.scene_exposures,
    )
    await db.commit()

    location = await _get_location_or_404(db, obj.id, scenario.id)
    await notify_active_sessions_for_scenario(db, scenario, ["locations", "scenes"])
    return LocationUpsertResult(**result.model_dump(), location=location)


@router.delete("/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_location(
    location_id: UUID,
    scenario: models.Scenario = Depends(get_scenario_edit),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    obj = await _load_location(db, location_id, scenario.id)

    from app.services.entity_lineage_service import assert_launched_entity_deletable

    try:
        assert_launched_entity_deletable(scenario, obj)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    await db.delete(obj)
    await db.commit()



# ── Дополнительные изображения ──────────────────────────────────────────────

@router.post("/{location_id}/images", response_model=scheme.LocationOut)
async def add_location_image(
    location_id: UUID,
    file: UploadFile = File(...),
    caption: Optional[str] = Form(None),
    scenario: models.Scenario = Depends(get_scenario_edit),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    obj = await _load_location(db, location_id, scenario.id)

    existing = list(obj.extra_images_data or [])
    index    = len(existing)
    url, path = await s3_service.upload_extra_image(
        file, f"location/{location_id}/images", str(location_id), index
    )
    existing.append({"url": url, "path": path, "caption": caption})
    obj.extra_images_data = existing

    await db.commit()
    return await _get_location_or_404(db, location_id, scenario.id)


@router.delete("/{location_id}/images/{image_index}", response_model=scheme.LocationOut)
async def delete_location_image(
    location_id: UUID,
    image_index: int,
    scenario: models.Scenario = Depends(get_scenario_edit),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    obj = await _load_location(db, location_id, scenario.id)

    existing = list(obj.extra_images_data or [])
    if image_index >= len(existing):
        raise HTTPException(404, "Изображение не найдено")

    entry = existing.pop(image_index)
    s3_service.delete_file(entry.get("url", ""))

    obj.extra_images_data = existing
    await db.commit()
    return await _get_location_or_404(db, location_id, scenario.id)



# ── Подлокации из JSON карты ────────────────────────────────────────────────

@router.post("/{location_id}/sublocation-from-map",
             response_model=scheme.SubLocationsFromMapResult)
async def create_sublocations_from_map(
    location_id: UUID,
    payload: scheme.SubLocationsFromMapPayload,
    scenario: models.Scenario = Depends(get_scenario_edit),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    parent = await _load_location(db, location_id, scenario.id)

    created_ids: list[UUID] = []

    for item in payload.items:
        # 1. Создать подлокацию
        child = models.Location(
            name=item.name,
            description_for_master=item.description_for_master or "",
            description_for_players=item.description_for_players or "",
            parent_location_id=location_id,
            scenario_id=scenario.id,
            tags=[],
        )
        db.add(child)
        await db.flush()   # получаем child.id до commit
        created_ids.append(child.id)

    await db.commit()

    # Загрузить созданные локации полностью
    created: list[scheme.LocationOut] = []
    for loc_id in created_ids:
        created.append(await _get_location_or_404(db, loc_id, scenario.id))

    return scheme.SubLocationsFromMapResult(created=created)