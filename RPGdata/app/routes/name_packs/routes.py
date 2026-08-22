"""Name pack CRUD and scenario links."""

from __future__ import annotations

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app import models
from app.auth import get_current_user, require_master
from app.auth.permissions import can_edit_scenario_meta
from app.auth.role import PERM_READ, get_scenario_permission, has_at_least
from app.infrastructure.database import get_async_session as get_db
from app.models.name_pack import NamePartKind
from app.routes._helpers import require_scenario_by_id
from app.services.name_generators import load_pack_entries_for_scenario, normalize_name_pack_tags

router = APIRouter(tags=["name_packs"])


class NamePackOut(BaseModel):
    id: UUID
    name: str
    tags: list[str] = []

    class Config:
        from_attributes = True


class NamePackCreate(BaseModel):
    name: str
    tags: list[str] = []


class NamePackUpdate(BaseModel):
    name: str | None = None
    tags: list[str] | None = None


class NamePackEntryOut(BaseModel):
    id: UUID
    pack_id: UUID
    text: str
    part_kind: str
    tags: list[str] = []
    description: str | None = None
    sort_order: int = 0

    class Config:
        from_attributes = True


class NamePackEntryIn(BaseModel):
    text: str
    part_kind: str = NamePartKind.full.value
    tags: list[str] = Field(default_factory=list)
    description: str | None = None
    sort_order: int = 0


class NamePackEntryUpdate(BaseModel):
    text: str | None = None
    part_kind: str | None = None
    tags: list[str] | None = None
    description: str | None = None
    sort_order: int | None = None


class BulkEntriesIn(BaseModel):
    lines: str
    part_kind: str = NamePartKind.given.value
    tags: list[str] = Field(default_factory=list)


def _validate_part_kind(value: str) -> str:
    allowed = {p.value for p in NamePartKind}
    if value not in allowed:
        raise HTTPException(status_code=400, detail=f"part_kind must be one of: {sorted(allowed)}")
    return value


class PackGeneratorEntriesOut(BaseModel):
    entries: list[dict] = Field(default_factory=list)


@router.get("/scenarios/{scenario_id}/name_generators/pack_entries", response_model=PackGeneratorEntriesOut)
async def scenario_linked_pack_name_entries(
    scenario_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_scenario_by_id(db, current_user, scenario_id, PERM_READ)
    entries = await load_pack_entries_for_scenario(db, scenario_id)
    return PackGeneratorEntriesOut(entries=entries)


@router.get("/name_packs", response_model=List[NamePackOut])
async def list_name_packs(
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(select(models.NamePack).order_by(models.NamePack.name.asc()))
    ).scalars().all()
    return rows


@router.post("/name_packs", response_model=NamePackOut)
async def create_name_pack(
    body: NamePackCreate,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Pack name is required")
    pack = models.NamePack(
        name=name,
        tags=normalize_name_pack_tags(body.tags),
    )
    db.add(pack)
    await db.commit()
    await db.refresh(pack)
    return pack


@router.get("/name_packs/{pack_id}", response_model=NamePackOut)
async def get_name_pack(
    pack_id: UUID,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    pack = (
        await db.execute(select(models.NamePack).where(models.NamePack.id == pack_id))
    ).scalars().first()
    if not pack:
        raise HTTPException(status_code=404, detail="Name pack not found")
    return pack


@router.patch("/name_packs/{pack_id}", response_model=NamePackOut)
async def update_name_pack(
    pack_id: UUID,
    body: NamePackUpdate,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    pack = (
        await db.execute(select(models.NamePack).where(models.NamePack.id == pack_id))
    ).scalars().first()
    if not pack:
        raise HTTPException(status_code=404, detail="Name pack not found")
    if body.name is not None:
        name = body.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Pack name is required")
        pack.name = name
    if body.tags is not None:
        pack.tags = normalize_name_pack_tags(body.tags)
    await db.commit()
    await db.refresh(pack)
    return pack


@router.get("/name_packs/{pack_id}/entries", response_model=List[NamePackEntryOut])
async def list_entries(
    pack_id: UUID,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    pack = (
        await db.execute(select(models.NamePack).where(models.NamePack.id == pack_id))
    ).scalars().first()
    if not pack:
        raise HTTPException(status_code=404, detail="Name pack not found")
    rows = (
        await db.execute(
            select(models.NamePackEntry)
            .where(models.NamePackEntry.pack_id == pack_id)
            .order_by(
                models.NamePackEntry.part_kind.asc(),
                models.NamePackEntry.sort_order.asc(),
                models.NamePackEntry.text.asc(),
            )
        )
    ).scalars().all()
    return rows


@router.post("/name_packs/{pack_id}/entries", response_model=NamePackEntryOut)
async def create_entry(
    pack_id: UUID,
    body: NamePackEntryIn,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    pack = (
        await db.execute(select(models.NamePack).where(models.NamePack.id == pack_id))
    ).scalars().first()
    if not pack:
        raise HTTPException(status_code=404, detail="Name pack not found")
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text is required")
    part_kind = _validate_part_kind(body.part_kind)
    entry_tags = normalize_name_pack_tags(body.tags)
    if not entry_tags:
        entry_tags = normalize_name_pack_tags(["npc", "character"])
    row = models.NamePackEntry(
        pack_id=pack_id,
        text=text,
        part_kind=part_kind,
        tags=entry_tags,
        description=(body.description or "").strip() or None,
        sort_order=body.sort_order,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


@router.post("/name_packs/{pack_id}/entries/bulk", response_model=dict)
async def bulk_create_entries(
    pack_id: UUID,
    body: BulkEntriesIn,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    pack = (
        await db.execute(select(models.NamePack).where(models.NamePack.id == pack_id))
    ).scalars().first()
    if not pack:
        raise HTTPException(status_code=404, detail="Name pack not found")
    part_kind = _validate_part_kind(body.part_kind)
    tags = normalize_name_pack_tags(body.tags)
    if not tags:
        tags = normalize_name_pack_tags(["npc", "character"])
    lines = [ln.strip() for ln in body.lines.splitlines() if ln.strip()]
    if not lines:
        raise HTTPException(status_code=400, detail="No lines to import")
    max_order = (
        await db.execute(
            select(models.NamePackEntry.sort_order)
            .where(models.NamePackEntry.pack_id == pack_id)
            .order_by(models.NamePackEntry.sort_order.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    order = (max_order or 0) + 1
    for line in lines:
        db.add(
            models.NamePackEntry(
                pack_id=pack_id,
                text=line,
                part_kind=part_kind,
                tags=tags,
                sort_order=order,
            )
        )
        order += 1
    await db.commit()
    return {"ok": True, "created": len(lines)}


@router.patch("/name_packs/{pack_id}/entries/{entry_id}", response_model=NamePackEntryOut)
async def update_entry(
    pack_id: UUID,
    entry_id: UUID,
    body: NamePackEntryUpdate,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    row = (
        await db.execute(
            select(models.NamePackEntry).where(
                models.NamePackEntry.id == entry_id,
                models.NamePackEntry.pack_id == pack_id,
            )
        )
    ).scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="Entry not found")
    if body.text is not None:
        text = body.text.strip()
        if not text:
            raise HTTPException(status_code=400, detail="Text is required")
        row.text = text
    if body.part_kind is not None:
        row.part_kind = _validate_part_kind(body.part_kind)
    if body.tags is not None:
        row.tags = normalize_name_pack_tags(body.tags)
    if body.description is not None:
        row.description = body.description.strip() or None
    if body.sort_order is not None:
        row.sort_order = body.sort_order
    await db.commit()
    await db.refresh(row)
    return row


@router.delete("/name_packs/{pack_id}/entries/{entry_id}", response_model=dict)
async def delete_entry(
    pack_id: UUID,
    entry_id: UUID,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    row = (
        await db.execute(
            select(models.NamePackEntry).where(
                models.NamePackEntry.id == entry_id,
                models.NamePackEntry.pack_id == pack_id,
            )
        )
    ).scalars().first()
    if row:
        await db.delete(row)
        await db.commit()
    return {"ok": True}


@router.post("/scenarios/{scenario_id}/name_packs/{name_pack_id}", response_model=dict)
async def link_name_pack(
    scenario_id: UUID,
    name_pack_id: UUID,
    enabled: bool = True,
    order_num: int = 0,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    sc = (
        await db.execute(select(models.Scenario).where(models.Scenario.id == scenario_id))
    ).scalars().first()
    if not sc:
        raise HTTPException(status_code=404, detail="Сценарий не найден")
    pack = (
        await db.execute(select(models.NamePack).where(models.NamePack.id == name_pack_id))
    ).scalars().first()
    if not pack:
        raise HTTPException(status_code=404, detail="Name pack not found")

    perm = await get_scenario_permission(db=db, user=current_user, scenario=sc)
    if not has_at_least(perm, PERM_READ):
        raise HTTPException(status_code=403, detail="Нет доступа")
    if not can_edit_scenario_meta(perm):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    link = (
        await db.execute(
            select(models.ScenarioNamePackLink).where(
                models.ScenarioNamePackLink.scenario_id == scenario_id,
                models.ScenarioNamePackLink.name_pack_id == name_pack_id,
            )
        )
    ).scalars().first()
    if link:
        link.enabled = enabled
        link.order_num = order_num
    else:
        db.add(
            models.ScenarioNamePackLink(
                scenario_id=scenario_id,
                name_pack_id=name_pack_id,
                enabled=enabled,
                order_num=order_num,
            )
        )
    await db.commit()
    return {"ok": True}


@router.delete("/scenarios/{scenario_id}/name_packs/{name_pack_id}", response_model=dict)
async def unlink_name_pack(
    scenario_id: UUID,
    name_pack_id: UUID,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    sc = (
        await db.execute(select(models.Scenario).where(models.Scenario.id == scenario_id))
    ).scalars().first()
    if not sc:
        raise HTTPException(status_code=404, detail="Сценарий не найден")
    perm = await get_scenario_permission(db=db, user=current_user, scenario=sc)
    if not can_edit_scenario_meta(perm):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    link = (
        await db.execute(
            select(models.ScenarioNamePackLink).where(
                models.ScenarioNamePackLink.scenario_id == scenario_id,
                models.ScenarioNamePackLink.name_pack_id == name_pack_id,
            )
        )
    ).scalars().first()
    if link:
        await db.delete(link)
        await db.commit()
    return {"ok": True}
