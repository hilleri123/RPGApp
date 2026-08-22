"""Entity pack CRUD and scenario template entity links."""

from __future__ import annotations

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.auth import require_master
from app.infrastructure.database import get_async_session as get_db
from app.auth.role import get_scenario_permission, PERM_READ, has_at_least
from app.auth.permissions import can_edit_scenario_entities
from app.services.entity_packs import normalize_pack_tags
from app.services.template_entities import (
    browse_template_entities_for_rule,
    browse_template_entities_for_pack_add,
    browse_unlinked_template_entities_for_scenario,
    validate_template_entity_for_pack_link,
    validate_template_entity_for_scenario_link,
)
from app.routes.template_sets.unified_helpers import ensure_pack_member

router = APIRouter(tags=["entity_packs"])


class EntityPackOut(BaseModel):
    id: UUID
    rule_id_str: str
    name: str
    tags: list[str] = []

    class Config:
        from_attributes = True


class EntityPackCreate(BaseModel):
    name: str
    rule_id_str: str
    tags: list[str] = []


class EntityPackUpdate(BaseModel):
    name: str | None = None
    tags: list[str] | None = None


class ScenarioTemplateEntityLinkIn(BaseModel):
    entity_kind: str
    entity_id: UUID
    enabled: bool = True
    order_num: int = 0


class EntityPackMemberIn(BaseModel):
    entity_kind: str
    entity_id: UUID


class TemplateEntityBrowseItem(BaseModel):
    id: UUID
    name: str
    tags: list[str] = []
    template_pack_id: UUID | None = None
    template_pack_name: str | None = None


@router.get("/rules/{rule_id_str}/entity_packs", response_model=List[EntityPackOut])
async def list_packs_for_rule(
    rule_id_str: str,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(models.EntityPack)
            .where(models.EntityPack.rule_id_str == rule_id_str)
            .order_by(models.EntityPack.name.asc())
        )
    ).scalars().all()
    return rows


@router.post("/rules/{rule_id_str}/entity_packs", response_model=EntityPackOut)
async def create_pack(
    rule_id_str: str,
    body: EntityPackCreate,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    pack = models.EntityPack(
        rule_id_str=rule_id_str,
        name=body.name,
        tags=normalize_pack_tags(body.tags),
    )
    db.add(pack)
    await db.commit()
    await db.refresh(pack)
    return pack


@router.get("/entity_packs/{pack_id}", response_model=EntityPackOut)
async def get_pack(
    pack_id: UUID,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    pack = (
        await db.execute(select(models.EntityPack).where(models.EntityPack.id == pack_id))
    ).scalars().first()
    if not pack:
        raise HTTPException(status_code=404, detail="Entity pack not found")
    return pack


@router.patch("/entity_packs/{pack_id}", response_model=EntityPackOut)
async def update_pack(
    pack_id: UUID,
    body: EntityPackUpdate,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    pack = (
        await db.execute(select(models.EntityPack).where(models.EntityPack.id == pack_id))
    ).scalars().first()
    if not pack:
        raise HTTPException(status_code=404, detail="Entity pack not found")
    if body.name is not None:
        name = body.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Pack name is required")
        pack.name = name
    if body.tags is not None:
        pack.tags = normalize_pack_tags(body.tags)
    await db.commit()
    await db.refresh(pack)
    return pack


@router.get(
    "/rules/{rule_id_str}/template_entities/{entity_kind}",
    response_model=List[TemplateEntityBrowseItem],
)
async def browse_templates_for_rule(
    rule_id_str: str,
    entity_kind: str,
    search: str | None = None,
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    rows = await browse_template_entities_for_rule(
        db,
        rule_id_str=rule_id_str,
        entity_kind=entity_kind,
        search=search,
        skip=skip,
        limit=limit,
    )
    return rows


@router.get(
    "/entity_packs/{pack_id}/browse_template_entities/{entity_kind}",
    response_model=List[TemplateEntityBrowseItem],
)
async def browse_templates_for_pack(
    pack_id: UUID,
    entity_kind: str,
    search: str | None = None,
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    rows = await browse_template_entities_for_pack_add(
        db,
        pack_id=pack_id,
        entity_kind=entity_kind,
        search=search,
        skip=skip,
        limit=limit,
    )
    return rows


@router.post("/entity_packs/{pack_id}/members", response_model=dict)
async def add_pack_member(
    pack_id: UUID,
    body: EntityPackMemberIn,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    pack = (
        await db.execute(select(models.EntityPack).where(models.EntityPack.id == pack_id))
    ).scalars().first()
    if not pack:
        raise HTTPException(status_code=404, detail="Entity pack not found")

    await validate_template_entity_for_pack_link(
        db,
        pack=pack,
        entity_kind=body.entity_kind,
        entity_id=body.entity_id,
    )
    await ensure_pack_member(
        db,
        pack_id=pack_id,
        entity_kind=body.entity_kind,
        entity_id=body.entity_id,
    )
    await db.commit()
    return {"ok": True}


@router.get(
    "/scenarios/{scenario_id}/browse_template_entities/{entity_kind}",
    response_model=List[TemplateEntityBrowseItem],
)
async def browse_templates_for_scenario(
    scenario_id: UUID,
    entity_kind: str,
    search: str | None = None,
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    sc = (
        await db.execute(select(models.Scenario).where(models.Scenario.id == scenario_id))
    ).scalars().first()
    if not sc:
        raise HTTPException(status_code=404, detail="Сценарий не найден")

    perm = await get_scenario_permission(db=db, user=current_user, scenario=sc)
    if not has_at_least(perm, PERM_READ):
        raise HTTPException(status_code=403, detail="Нет доступа")

    rows = await browse_unlinked_template_entities_for_scenario(
        db,
        scenario_id=scenario_id,
        entity_kind=entity_kind,
        search=search,
        skip=skip,
        limit=limit,
    )
    return rows


@router.post("/scenarios/{scenario_id}/template_entities", response_model=dict)
async def link_template_entity(
    scenario_id: UUID,
    body: ScenarioTemplateEntityLinkIn,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    sc = (
        await db.execute(select(models.Scenario).where(models.Scenario.id == scenario_id))
    ).scalars().first()
    if not sc:
        raise HTTPException(status_code=404, detail="Сценарий не найден")

    perm = await get_scenario_permission(db=db, user=current_user, scenario=sc)
    if not can_edit_scenario_entities(perm):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    await validate_template_entity_for_scenario_link(
        db,
        scenario=sc,
        entity_kind=body.entity_kind,
        entity_id=body.entity_id,
    )

    link = (
        await db.execute(
            select(models.ScenarioTemplateEntityLink).where(
                models.ScenarioTemplateEntityLink.scenario_id == scenario_id,
                models.ScenarioTemplateEntityLink.entity_kind == body.entity_kind,
                models.ScenarioTemplateEntityLink.entity_id == body.entity_id,
            )
        )
    ).scalars().first()

    if link:
        link.enabled = body.enabled
        link.order_num = body.order_num
    else:
        db.add(
            models.ScenarioTemplateEntityLink(
                scenario_id=scenario_id,
                entity_kind=body.entity_kind,
                entity_id=body.entity_id,
                enabled=body.enabled,
                order_num=body.order_num,
            )
        )

    await db.commit()
    return {"ok": True}


@router.delete("/scenarios/{scenario_id}/template_entities/{entity_kind}/{entity_id}", response_model=dict)
async def unlink_template_entity(
    scenario_id: UUID,
    entity_kind: str,
    entity_id: UUID,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    sc = (
        await db.execute(select(models.Scenario).where(models.Scenario.id == scenario_id))
    ).scalars().first()
    if not sc:
        raise HTTPException(status_code=404, detail="Сценарий не найден")

    perm = await get_scenario_permission(db=db, user=current_user, scenario=sc)
    if not can_edit_scenario_entities(perm):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    link = (
        await db.execute(
            select(models.ScenarioTemplateEntityLink).where(
                models.ScenarioTemplateEntityLink.scenario_id == scenario_id,
                models.ScenarioTemplateEntityLink.entity_kind == entity_kind,
                models.ScenarioTemplateEntityLink.entity_id == entity_id,
            )
        )
    ).scalars().first()
    if link:
        await db.delete(link)
        await db.commit()
    return {"ok": True}
