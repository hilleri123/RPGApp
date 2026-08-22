from typing import List, Optional
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from app.auth.role import get_scenario_permission, can_edit_scenario_meta, can_delete_scenario, has_at_least, PERM_READ, PERM_ALL
from app.routes.scenarios.access import can_access_scenario, can_duplicate_scenario, require_scenario_access
from app.infrastructure.database import get_async_session as get_db
from app.infrastructure import s3_service
from app import models, scheme
from app.auth import require_master
from app.services.entity_packs import DEFAULT_PACK_TAG

router = APIRouter(prefix="/scenarios", tags=["scenarios"])

# ------------------ helper ------------------------



async def ensure_default_template_set(db: AsyncSession, *, scenario: models.Scenario) -> models.EntityPack:
    """Create default entity pack for new scenario and link it."""
    link = (
        await db.execute(
            select(models.ScenarioEntityPackLink)
            .where(models.ScenarioEntityPackLink.scenario_id == scenario.id)
            .order_by(models.ScenarioEntityPackLink.order_num.asc())
        )
    ).scalars().first()

    if link:
        pack = (
            await db.execute(
                select(models.EntityPack).where(models.EntityPack.id == link.pack_id)
            )
        ).scalars().first()
        if pack:
            if pack.rule_id_str != scenario.rule_id_str:
                pack.rule_id_str = scenario.rule_id_str
                await db.commit()
                await db.refresh(pack)
            return pack

    pack = models.EntityPack(
        rule_id_str=scenario.rule_id_str,
        name=f"Пак шаблонов: {scenario.name}",
        tags=[DEFAULT_PACK_TAG],
    )
    db.add(pack)
    await db.flush()

    db.add(
        models.ScenarioEntityPackLink(
            scenario_id=scenario.id,
            pack_id=pack.id,
            enabled=True,
            order_num=0,
        )
    )
    await db.commit()
    await db.refresh(pack)
    return pack



# ----------------- CRUD ------------------------



@router.post("", response_model=scheme.Scenario)
@router.post("/", response_model=scheme.Scenario)
async def create_scenario(
    scenario: scheme.ScenarioCreate,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db)
):
    """Создать новый сценарий"""
    data = scenario.model_dump()
    data["user_id"] = current_user.id
    db_scenario = models.Scenario(**data)
    db.add(db_scenario)
    await db.commit()
    await db.refresh(db_scenario)

    await ensure_default_template_set(db, scenario=db_scenario)

    result = await db.execute(
        select(models.Scenario).where(models.Scenario.id == db_scenario.id).options(
            selectinload(models.Scenario.user),
            selectinload(models.Scenario.characters)
        )
    )
    loaded_scenario = result.scalars().first()
    if db_scenario is None:
        raise HTTPException(status_code=404, detail="Сценарий не найден")
    return loaded_scenario

@router.post("/{scenario_id}/icon", response_model=scheme.Scenario)
async def add_icon(
    scenario_id: UUID,
    icon: UploadFile = File(...),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db)
):
    if not icon:
        raise HTTPException(status_code=400, detail="Иконка не найдена")
    
    # Получаем сценарий
    result = await db.execute(select(models.Scenario).where(models.Scenario.id == scenario_id))
    scenario = result.scalars().first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Сценарий не найден")

    perm = await get_scenario_permission(db, current_user, scenario)
    if not can_edit_scenario_meta(perm):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет доступа")

    # Загружаем иконку в S3
    icon_url = await s3_service.upload_file(icon, "icons")
    scenario.icon = icon_url
    
    await db.commit()
    await db.refresh(scenario, ["rule", "rule.skill_groups", "characters"])
    return scenario

@router.get("", response_model=List[scheme.Scenario])
@router.get("/", response_model=List[scheme.Scenario])
async def read_scenarios(
    skip: int = 0,
    limit: int = 100,
    rule_id_str: Optional[str] = None,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db)
):
    """Получить список всех сценариев"""
    stmt = (
        select(models.Scenario)
        .where(models.Scenario.is_session_snapshot == False)
        .options(
            selectinload(models.Scenario.user),
            selectinload(models.Scenario.characters)
        )
        .offset(skip)
        .limit(limit)
    )
    if rule_id_str:
        stmt = stmt.where(models.Scenario.rule_id_str == rule_id_str)
    result = await db.execute(stmt)
    scenarios = result.scalars().all()

    enriched_scenarios = []
    for scenario in scenarios:
        perm = await get_scenario_permission(db, current_user, scenario)
        if not has_at_least(perm, PERM_READ):
            continue
        item = scheme.Scenario.model_validate(scenario)
        item.permission = perm
        enriched_scenarios.append(item)

    return enriched_scenarios


@router.get("/{scenario_id}", response_model=scheme.ScenarioWithCounts)
async def read_scenario(
    scenario_id: UUID,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(models.Scenario)
        .where(models.Scenario.id == scenario_id)
        .options(selectinload(models.Scenario.user))
    )
    sc = result.scalars().first()
    if not sc:
        raise HTTPException(status_code=404, detail="Сценарий не найден")

    if not await can_access_scenario(db, current_user, sc):
        raise HTTPException(status_code=403, detail="Нет доступа")

    perm = await get_scenario_permission(db, current_user, sc)

    ts = await ensure_default_template_set(db, scenario=sc)
    # --- NEW: template_set_id (дефолтный) ---
    # Если ты перешёл на модель "scenario_id != NULL => дефолтный", то тут просто where RuleTemplateSet.scenario_id == sc.id
    default_template_set_id = ts.id

    # --- NEW: linked_template_set_ids ---
    linked_template_set_ids = (await db.execute(
        select(models.ScenarioEntityPackLink.pack_id).where(
            models.ScenarioEntityPackLink.scenario_id == sc.id,
            models.ScenarioEntityPackLink.enabled == True,
        ).order_by(models.ScenarioEntityPackLink.order_num.asc())
    )).scalars().all()

    linked_name_pack_ids = (await db.execute(
        select(models.ScenarioNamePackLink.name_pack_id).where(
            models.ScenarioNamePackLink.scenario_id == sc.id,
            models.ScenarioNamePackLink.enabled == True,
        ).order_by(models.ScenarioNamePackLink.order_num.asc())
    )).scalars().all()

    # counts (как у тебя)
    locations_count = await db.scalar(select(func.count()).select_from(models.Location).where(models.Location.scenario_id == sc.id))
    characters_count = await db.scalar(select(func.count()).select_from(models.PlayerCharacter).where(models.PlayerCharacter.scenario_id == sc.id))
    npcs_count = await db.scalar(select(func.count()).select_from(models.NPC).where(models.NPC.scenario_id == sc.id))
    items_count = await db.scalar(select(func.count()).select_from(models.GameItem).where(models.GameItem.scenario_id == sc.id))
    notes_count = await db.scalar(select(func.count()).select_from(models.Note).where(models.Note.scenario_id == sc.id))
    counters_count = await db.scalar(select(func.count()).select_from(models.Counter).where(models.Counter.scenario_id == sc.id))
    story_beats_count = await db.scalar(select(func.count()).select_from(models.StoryBeat).where(models.StoryBeat.scenario_id == sc.id))

    base = scheme.Scenario.model_validate(sc).model_dump()
    base["permission"] = perm

    return scheme.ScenarioWithCounts(
        **base,
        template_set_id=default_template_set_id,
        linked_template_set_ids=list(linked_template_set_ids),
        linked_name_pack_ids=list(linked_name_pack_ids),
        counts=scheme.ScenarioCounts(
            locations=locations_count or 0,
            characters=characters_count or 0,
            npcs=npcs_count or 0,
            items=items_count or 0,
            notes=notes_count or 0,
            counters=counters_count or 0,
            story_beats=story_beats_count or 0,
        ),
    )


@router.put("/{scenario_id}", response_model=scheme.Scenario)
async def update_scenario(
    scenario_id: UUID,
    name: str = Form(...),
    intro: Optional[str] = Form(None),
    max_players: Optional[int] = Form(None),
    rule_id_str: Optional[str] = Form(None),
    scenario_starts_at: Optional[datetime] = Form(None),
    icon: Optional[UploadFile] = File(None),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(models.Scenario)
        .where(models.Scenario.id == scenario_id)
        .options(selectinload(models.Scenario.user))
    )
    db_scenario = result.scalars().first()

    if db_scenario is None:
        raise HTTPException(status_code=404, detail="Сценарий не найден")

    if not await can_access_scenario(db, current_user, db_scenario):
        raise HTTPException(status_code=403, detail="Нет доступа")

    perm = await get_scenario_permission(db, current_user, db_scenario)
    if not can_edit_scenario_meta(perm):
        raise HTTPException(status_code=403, detail="Недостаточно прав для редактирования сценария")

    db_scenario.name = name
    db_scenario.intro = intro
    db_scenario.max_players = max_players
    db_scenario.rule_id_str = rule_id_str
    db_scenario.scenario_starts_at = scenario_starts_at

    if icon is not None:
        icon_url = await s3_service.upload_file(icon, "icons")
        db_scenario.icon_url = icon_url

    await db.commit()
    await db.refresh(db_scenario)

    result = await db.execute(
        select(models.Scenario)
        .where(models.Scenario.id == scenario_id)
        .options(selectinload(models.Scenario.user))
    )
    updated = result.scalars().first()
    from app.routes._helpers import notify_active_sessions_for_scenario
    await notify_active_sessions_for_scenario(db, updated, ["timeline"])
    return updated


@router.post("/{scenario_id}/duplicate", response_model=scheme.Scenario, status_code=status.HTTP_201_CREATED)
async def duplicate_scenario(
    scenario_id: UUID,
    payload: scheme.ScenarioDuplicateRequest = Body(default_factory=scheme.ScenarioDuplicateRequest),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    """Создать копию сценария (доступно при read+)."""
    result = await db.execute(
        select(models.Scenario).where(models.Scenario.id == scenario_id)
    )
    source = result.scalars().first()
    if source is None:
        raise HTTPException(status_code=404, detail="Сценарий не найден")

    if source.is_session_snapshot:
        raise HTTPException(status_code=400, detail="Нельзя копировать снимок сессии")

    if not await can_duplicate_scenario(db, current_user, source):
        raise HTTPException(status_code=403, detail="Недостаточно прав для копирования")

    from app.services.scenario_cloner import duplicate_scenario_for_user

    try:
        clone_result = await duplicate_scenario_for_user(
            db,
            source_scenario_id=scenario_id,
            owner_user_id=current_user.id,
            new_name=payload.name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    await db.commit()
    await db.refresh(clone_result.scenario, ["user"])
    item = scheme.Scenario.model_validate(clone_result.scenario)
    item.permission = PERM_ALL
    return item


@router.delete("/{scenario_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_scenario(
    scenario_id: UUID,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db)
):
    """Удалить сценарий"""
    result = await db.execute(
        select(models.Scenario).where(models.Scenario.id == scenario_id)
    )
    db_scenario = result.scalars().first()
    if db_scenario is None:
        raise HTTPException(status_code=404, detail="Сценарий не найден")

    perm = await get_scenario_permission(db, current_user, db_scenario)
    if not can_delete_scenario(perm):
        raise HTTPException(status_code=403, detail="Недостаточно прав для удаления")

    linked_sessions = await db.scalar(
        select(func.count())
        .select_from(models.GameSession)
        .where(models.GameSession.scenario_id == scenario_id)
    )
    if linked_sessions:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Нельзя удалить сценарий: есть связанные игровые сессии",
        )

    await db.delete(db_scenario)
    await db.commit()
    return None



# ------------ TEMPLATES -------------------------

@router.post("/{scenario_id}/template_sets/{template_set_id}", response_model=dict)
async def add_template_set_link(
    scenario_id: UUID,
    template_set_id: UUID,
    enabled: bool = True,
    order_num: int = 0,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    sc = (await db.execute(select(models.Scenario).where(models.Scenario.id == scenario_id))).scalars().first()
    if not sc:
        raise HTTPException(status_code=404, detail="Сценарий не найден")

    ts = (await db.execute(select(models.EntityPack).where(models.EntityPack.id == template_set_id))).scalars().first()
    if not ts:
        raise HTTPException(status_code=404, detail="Entity pack не найден")

    if getattr(ts, "rule_id_str", None) and getattr(sc, "rule_id_str", None) and ts.rule_id_str != sc.rule_id_str:
        raise HTTPException(status_code=400, detail="Template set belongs to another rule")

    perm = await get_scenario_permission(db=db, user=current_user, scenario=sc)
    if not has_at_least(perm, PERM_READ):
        raise HTTPException(status_code=403, detail="Нет доступа")
    if not can_edit_scenario_meta(perm):
        raise HTTPException(status_code=403, detail="Недостаточно прав для изменения шаблонов")

    # upsert линка
    link = (await db.execute(
        select(models.ScenarioEntityPackLink).where(
            models.ScenarioEntityPackLink.scenario_id == scenario_id,
            models.ScenarioEntityPackLink.pack_id == template_set_id,
        )
    )).scalars().first()

    if link:
        link.enabled = enabled
        link.order_num = order_num
    else:
        link = models.ScenarioEntityPackLink(
            scenario_id=scenario_id,
            pack_id=template_set_id,
            enabled=enabled,
            order_num=order_num,
        )
        db.add(link)

    await db.commit()
    return {"ok": True}

@router.delete("/{scenario_id}/template_sets/{template_set_id}", response_model=dict)
async def remove_template_set_link(
    scenario_id: UUID,
    template_set_id: UUID,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    sc = (await db.execute(select(models.Scenario).where(models.Scenario.id == scenario_id))).scalars().first()
    if not sc:
        raise HTTPException(status_code=404, detail="Сценарий не найден")

    perm = await get_scenario_permission(db=db, user=current_user, scenario=sc)
    if not can_edit_scenario_meta(perm):
        raise HTTPException(status_code=403, detail="Недостаточно прав для изменения шаблонов")

    link = (await db.execute(
        select(models.ScenarioEntityPackLink).where(
            models.ScenarioEntityPackLink.scenario_id == scenario_id,
            models.ScenarioEntityPackLink.pack_id == template_set_id,
        )
    )).scalars().first()

    if not link:
        raise HTTPException(404, "Link not found")

    await db.delete(link)
    await db.commit()
    return {"ok": True}

