from typing import Any, Dict, Iterable, Optional, Set, Tuple, List
from uuid import UUID
from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete, select
from sqlalchemy.orm import selectinload

from app.plugins.contracts import EntityPayload, ValidationResult
from app.plugins.resolver import get_factory_from_db
from app.services.entity_data_rule import stamp_entity_payload
from app.infrastructure.database import get_async_session as get_db
from app.logger import logger
from app import models, scheme
from app.auth import require_master
from app.auth.permissions import PERM_EDIT_FULL, PERM_EDIT_PARTIAL, PERM_READ
from app.routes.scenarios.access import require_scenario_access


async def notify_active_sessions_for_scenario(
    db: AsyncSession,
    scenario: models.Scenario,
    fields: list[str],
) -> None:
    """After REST mutation on a session snapshot, push WS updates to connected clients."""
    if not getattr(scenario, "is_session_snapshot", False):
        return
    from app.services.session_live_sync import notify_session_snapshot_entity_change

    await notify_session_snapshot_entity_change(db, scenario.id, fields)




# ------------------ Scenario ----------------


async def _load_scenario(scenario_id: UUID, db: AsyncSession) -> models.Scenario:
    scenario = (await db.execute(
        select(models.Scenario).where(models.Scenario.id == scenario_id)
    )).scalars().first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Сценарий не найден")
    return scenario


async def get_scenario_or_404(
    scenario_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(require_master),
) -> models.Scenario:
    scenario = await _load_scenario(scenario_id, db)
    await require_scenario_access(db, current_user, scenario, PERM_READ)
    return scenario


def require_scenario(min_permission: str):
    async def _dep(
        scenario_id: UUID,
        db: AsyncSession = Depends(get_db),
        current_user: models.User = Depends(require_master),
    ) -> models.Scenario:
        scenario = await _load_scenario(scenario_id, db)
        await require_scenario_access(db, current_user, scenario, min_permission)
        return scenario

    return _dep


get_scenario_edit = require_scenario(PERM_EDIT_PARTIAL)
get_scenario_meta_edit = require_scenario(PERM_EDIT_FULL)


async def require_scenario_by_id(
    db: AsyncSession,
    user: models.User,
    scenario_id: UUID,
    min_permission: str = PERM_READ,
) -> models.Scenario:
    """Императивный вариант проверки доступа — для роутов, где id сценария
    приходит в теле или в query, а не в пути."""
    scenario = await _load_scenario(scenario_id, db)
    await require_scenario_access(db, user, scenario, min_permission)
    return scenario


# ----------------- VALIDATE -----------------


async def validate_entity_data(
    *,
    db: AsyncSession,
    entity: str,          # "character" | "npc" | ...
    payload: EntityPayload,
    scenario_id: Optional[UUID] = None,
    template_set_id: Optional[UUID] = None,
) -> ValidationResult:
    factory = await get_factory_from_db(db, scenario_id, template_set_id)
    if not factory:
        raise HTTPException(status_code=404, detail="Ruleset not found")

    res = factory.handle(
        kind="validate",
        entity=entity,
        payload=payload.model_dump(mode="json"),
        context={},
    )
    if res is None:
        raise RuntimeError("validate_entity_data returned no result")

    res = ValidationResult.model_validate(res)
    if res.result is None:
        res.result = EntityPayload()

    rule_id_str = getattr(factory, "system_id", None)
    if res.result and rule_id_str:
        res.result = stamp_entity_payload(res.result, rule_id_str)

    return res


# -------- LOAD --------------------------------------------



async def load_locations(db: AsyncSession, scenario_id: UUID, ids: List[UUID]) -> list[models.Location]:
    if not ids:
        return []
    rows = (await db.execute(
        select(models.Location).where(
            models.Location.scenario_id == scenario_id,
            models.Location.id.in_(ids),
        )
    )).scalars().all()

    if len(rows) != len(set(ids)):
        raise HTTPException(400, "Some locations not found in scenario")
    return rows



async def load_npcs(db: AsyncSession, scenario_id: UUID, ids: List[UUID]) -> list[models.NPC]:
    if not ids:
        return []
    rows = (await db.execute(
        select(models.NPC)
        .where(models.NPC.scenario_id == scenario_id, models.NPC.id.in_(ids))
    )).scalars().all()
    if len(rows) != len(set(ids)):
        raise HTTPException(400, "Some NPC not found in scenario")
    return rows






async def load_items(db: AsyncSession, scenario_id: UUID, ids: List[UUID]) -> list[models.GameItem]:
    if not ids:
        return []
    rows = (await db.execute(
        select(models.GameItem)
        .options(
            selectinload(models.GameItem.ownership_link).selectinload(models.ItemOwnership.character),
            selectinload(models.GameItem.ownership_link).selectinload(models.ItemOwnership.npc),
            selectinload(models.GameItem.ownership_link).selectinload(models.ItemOwnership.owner_item),
        )
        .where(models.GameItem.scenario_id == scenario_id, models.GameItem.id.in_(ids))
    )).scalars().all()
    if len(rows) != len(set(ids)):
        raise HTTPException(400, "Some items not found in scenario")
    return rows




async def load_template_npcs(
    db: AsyncSession,
    scenario_id: UUID,
    links: List[scheme.TemplateNPCLink],  # было List[UUID]
) -> list[tuple[models.NPC, int]]:
    if not links:
        return []

    from app.services.template_entities import resolve_template_entity_ids_for_scenario

    allowed = await resolve_template_entity_ids_for_scenario(db, scenario_id, "npc")
    ids = [l.id for l in links]
    qty_by_id = {l.id: l.qty for l in links}

    missing_allowed = [i for i in ids if i not in allowed]
    if missing_allowed:
        raise HTTPException(400, "Some template NPC not available for scenario")

    rows = (
        await db.execute(
            select(models.NPC).where(
                models.NPC.id.in_(ids),
                models.NPC.scenario_id.is_(None),
            )
        )
    ).scalars().all()

    by_id = {row.id: row for row in rows}
    missing = [i for i in ids if i not in by_id]
    if missing:
        raise HTTPException(400, "Some template NPC not found in scenario")

    return [(by_id[i], qty_by_id[i]) for i in ids]


async def load_template_items(
    db: AsyncSession,
    scenario_id: UUID,
    links: List[scheme.TemplateItemLink],  # было List[UUID]
) -> list[tuple[models.GameItem, int]]:
    if not links:
        return []

    from app.services.template_entities import resolve_template_entity_ids_for_scenario

    allowed = await resolve_template_entity_ids_for_scenario(db, scenario_id, "game_item")
    ids = [l.id for l in links]
    qty_by_id = {l.id: l.qty for l in links}

    missing_allowed = [i for i in ids if i not in allowed]
    if missing_allowed:
        raise HTTPException(400, "Some template items not available for scenario")

    rows = (
        await db.execute(
            select(models.GameItem).where(
                models.GameItem.id.in_(ids),
                models.GameItem.scenario_id.is_(None),
            )
        )
    ).scalars().all()

    by_id = {row.id: row for row in rows}
    missing = [i for i in ids if i not in by_id]
    if missing:
        raise HTTPException(400, "Some template items not found in scenario")

    return [(by_id[i], qty_by_id[i]) for i in ids]


async def load_obstacles(
    db: AsyncSession,
    scenario_id: UUID,
    obstacles: List[scheme.ObstacleCreate],
) -> list[models.Obstacle]:
    if not obstacles:
        return []

    # 1) собрать ids refs (если id присутствует в схеме)
    ids: list[UUID] = []
    for o in obstacles:
        oid = getattr(o, "id", None)
        if isinstance(oid, UUID):
            ids.append(oid)

    uniq_ids = list(set(ids))

    # 2) загрузить существующие одним запросом и провалидировать "все найдены"
    existing_by_id: Dict[UUID, models.Obstacle] = {}
    if uniq_ids:
        rows = (
            await db.execute(
                select(models.Obstacle)
                .where(
                    models.Obstacle.scenario_id == scenario_id,
                    models.Obstacle.id.in_(uniq_ids),
                )
            )
        ).scalars().all()

        existing_by_id = {row.id: row for row in rows}

        missing = [str(i) for i in uniq_ids if i not in existing_by_id]
        if missing:
            raise HTTPException(status_code=400, detail=f"Some obstacles not found in scenario: {missing}")

    # 3) собрать результат в исходном порядке: ref -> ORM из БД, inline -> новый ORM
    result: list[models.Obstacle] = []

    for o in obstacles:
        oid: Optional[UUID] = getattr(o, "id", None)

        if oid is not None:
            result.append(existing_by_id[oid])
            continue

        # inline create
        name = (o.name or "").strip()
        if not name:
            raise HTTPException(status_code=400, detail="Obstacle.name is required")

        result.append(
            models.Obstacle(
                scenario_id=scenario_id,
                name=name,
                description_for_master=o.description_for_master,
                description_for_players=o.description_for_players,
                data=o.data or {},
                tags=o.tags or [],
            )
        )

    return result



# ------------- ENRICH --------------------------------


_OWNER_FIELD = {
    models.OwnerTypeEnum.character: models.ItemOwnership.character_id,
    models.OwnerTypeEnum.npc: models.ItemOwnership.npc_id,
    models.OwnerTypeEnum.item: models.ItemOwnership.owner_item_id,
}

async def apply_item_ownership(
    db: AsyncSession,
    *,
    scenario_id: UUID,
    owner_type: models.OwnerTypeEnum,
    owner_id: UUID,
    owned_items: list[scheme.ItemContainedLinkIn],
    validate_qty: bool = True,
) -> None:
    # 1) validate items exist in scenario
    item_ids = [x.item_id for x in owned_items]
    if item_ids:
        rows = (await db.execute(
            select(models.GameItem.id)
            .where(models.GameItem.id.in_(item_ids))
            .where(models.GameItem.scenario_id == scenario_id)
        )).scalars().all()

        found = set(rows)
        missing = [str(i) for i in item_ids if i not in found]
        if missing:
            raise HTTPException(status_code=400, detail=f"Некоторые предметы не найдены в сценарии: {missing}")

    owner_col = _OWNER_FIELD[owner_type]

    # 2) delete previous links for this owner only (как и раньше)
    await db.execute(delete(models.ItemOwnership).where(owner_col == owner_id))
    await db.flush()  # важно, чтобы уникальность по item_id освободилась в рамках транзакции

    # helper: текущий владелец совпадает с тем, кого мы апдейтим?
    def _same_owner(link: models.ItemOwnership) -> bool:
        if owner_type == models.OwnerTypeEnum.character:
            return link.character_id == owner_id
        if owner_type == models.OwnerTypeEnum.npc:
            return link.npc_id == owner_id
        if owner_type == models.OwnerTypeEnum.item:
            return link.owner_item_id == owner_id
        return False

    # 3) create new links
    for x in owned_items:
        # 3.1) проверяем: есть ли уже владелец у item_id
        existing_q = (
            select(models.ItemOwnership)
            .where(models.ItemOwnership.item_id == x.item_id)
            .options(
                selectinload(models.ItemOwnership.character),
                selectinload(models.ItemOwnership.npc),
                selectinload(models.ItemOwnership.owner_item),
            )
        )
        existing = (await db.execute(existing_q)).scalars().first()

        if existing and not _same_owner(existing):
            if not x.take_from_other_owner:
                # можно вернуть детали владельца, чтобы UI показал подтверждение
                owner_payload = None
                if existing.character_id and existing.character:
                    owner_payload = {"type": "character", "id": str(existing.character_id), "name": existing.character.name}
                elif existing.npc_id and existing.npc:
                    owner_payload = {"type": "npc", "id": str(existing.npc_id), "name": existing.npc.name}
                elif existing.owner_item_id and existing.owner_item:
                    owner_payload = {"type": "item", "id": str(existing.owner_item_id), "name": existing.owner_item.name}

                raise HTTPException(
                    status_code=409,
                    detail={"code": "ITEM_ALREADY_OWNED", "item_id": str(x.item_id), "owner": owner_payload},
                )

            # take_from_other_owner=True => отбираем: удаляем старую связь
            await db.delete(existing)
            await db.flush()

        # 3.2) создаём новую ownership
        link = models.ItemOwnership(item_id=x.item_id)

        if owner_type == models.OwnerTypeEnum.character:
            link.character_id = owner_id
        elif owner_type == models.OwnerTypeEnum.npc:
            link.npc_id = owner_id
        elif owner_type == models.OwnerTypeEnum.item:
            link.owner_item_id = owner_id
        else:
            raise HTTPException(status_code=500, detail="Unknown owner type")

        db.add(link)

    # commit снаружи, как у тебя сейчас



#--------------- scebe_exposure --------------


async def sync_scene_exposures(
    db: AsyncSession,
    scenario_id: UUID,
    payload_exposures: List[scheme.SceneExposureCreate],  # или базовый тип с id/name/order_num/npc_ids/item_ids/obstacles
    location_id: Optional[UUID] = None,
    story_beat_id: Optional[UUID] = None,
) -> None:
    """
    Upsert коллекции SceneExposure, принадлежащей либо Location, либо StoryBeat.

    Ровно одно из (location_id, story_beat_id) должно быть задано.
    """
    if (location_id is None) == (story_beat_id is None):
        raise ValueError("Exactly one of location_id or story_beat_id must be provided")

    keep_ids: Set[UUID] = {se.id for se in payload_exposures if getattr(se, "id", None) is not None}

    # --- delete removed ---
    owner_filter = (
        (models.SceneExposure.location_id == location_id)
        if location_id is not None
        else (models.SceneExposure.story_beat_id == story_beat_id)
    )

    stmt_delete = delete(models.SceneExposure).where(owner_filter)
    if keep_ids:
        stmt_delete = stmt_delete.where(models.SceneExposure.id.notin_(keep_ids))

    await db.execute(stmt_delete)

    # --- upsert each ---
    for se in payload_exposures:
        npc_list = await load_npcs(db, scenario_id, se.npc_ids)
        item_list = await load_items(db, scenario_id, se.item_ids)
        template_npc_pairs = await load_template_npcs(db, scenario_id, se.template_npc_ids)
        template_item_pairs = await load_template_items(db, scenario_id, se.template_item_ids)
        obstacle_list = await load_obstacles(db, scenario_id, se.obstacles)

        # помним теги из payload
        exposure_tags = se.tags or []

        # для препятствий: сопоставим payload-объект и ORM, чтобы потом синкнуть теги
        obstacles_with_payload: list[tuple[scheme.ObstacleCreate, models.Obstacle]] = []
        for o_payload, o_orm in zip(se.obstacles, obstacle_list):
            obstacles_with_payload.append((o_payload, o_orm))

        if se.id:
            stmt = (
                select(models.SceneExposure)
                .options(
                    selectinload(models.SceneExposure.npcs),
                    selectinload(models.SceneExposure.items),

                    selectinload(models.SceneExposure.template_npc_links)
                        .selectinload(models.SceneExposureTemplateNPC.template_npc),

                    selectinload(models.SceneExposure.template_item_links)
                        .selectinload(models.SceneExposureTemplateItem.template_item),

                    selectinload(models.SceneExposure.obstacles),
                )
                .where(
                    models.SceneExposure.id == se.id,
                    models.SceneExposure.scenario_id == scenario_id,
                    owner_filter,
                )
            )
            exposure = (await db.execute(stmt)).scalars().first()
            if not exposure:
                raise HTTPException(400, f"SceneExposure {se.id} not found for this owner")

            exposure.name = se.name
            exposure.order_num = se.order_num
            exposure.location_id = location_id
            exposure.story_beat_id = story_beat_id

            exposure.npcs = npc_list
            exposure.items = item_list
            exposure.obstacles = obstacle_list
        else:
            exposure = models.SceneExposure(
                scenario_id=scenario_id,
                name=se.name,
                order_num=se.order_num,
                location_id=location_id,
                story_beat_id=story_beat_id,
            )
            exposure.npcs = npc_list
            exposure.items = item_list
            exposure.obstacles = obstacle_list
            db.add(exposure)
            
        exposure.template_npc_links = [
            models.SceneExposureTemplateNPC(template_npc=npc, qty=qty)
            for npc, qty in template_npc_pairs
        ]
        exposure.template_item_links = [
            models.SceneExposureTemplateItem(template_item=item, qty=qty)
            for item, qty in template_item_pairs
        ]
        
        # нужно, чтобы у exposure и новых obstacles были id
        await db.flush()
        
        await _sync_audio_links(db, exposure_id=exposure.id, audio_links=se.audio_ids)



async def _sync_audio_links(
    db: AsyncSession,
    exposure_id: UUID,
    audio_links: List[scheme.ExposureAudioLinkIn],
) -> None:
    # удаляем все старые ссылки для этого exposure — проще чем диффить
    await db.execute(
        delete(models.SceneExposureAudio).where(
            models.SceneExposureAudio.scene_exposure_id == exposure_id
        )
    )
    await db.flush()

    for link in audio_links:
        db.add(models.SceneExposureAudio(
            scene_exposure_id=exposure_id,
            audio_track_id=link.audio_track_id,
            volume=link.volume,
            loop=link.loop,
            fade_in=link.fade_in,
            fade_out=link.fade_out,
            order_num=link.order_num,
        ))
