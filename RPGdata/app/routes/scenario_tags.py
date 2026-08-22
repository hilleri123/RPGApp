from __future__ import annotations

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app import models, scheme
from app.auth import require_master
from app.infrastructure.database import get_async_session as get_db
from app.routes._helpers import get_scenario_edit, get_scenario_or_404, notify_active_sessions_for_scenario
from app.services import front_service as svc

router = APIRouter(prefix="/scenarios/{scenario_id}/tags", tags=["scenario-tags"])


@router.get("", response_model=List[scheme.ScenarioTagOut])
async def list_tags(
    scenario: models.Scenario = Depends(get_scenario_or_404),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(models.ScenarioTag)
            .where(models.ScenarioTag.scenario_id == scenario.id)
            .order_by(models.ScenarioTag.key.asc())
        )
    ).scalars().all()
    return rows


@router.post("", response_model=scheme.ScenarioTagOut, status_code=status.HTTP_201_CREATED)
async def create_tag(
    body: scheme.ScenarioTagCreate,
    scenario: models.Scenario = Depends(get_scenario_edit),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    if body.kind == "front":
        raise HTTPException(status_code=400, detail="front tags are created with Front")
    key = await svc.unique_tag_key(db, scenario.id, body.key or body.label)
    tag = models.ScenarioTag(
        scenario_id=scenario.id,
        key=key,
        label=(body.label or key).strip() or key,
        description=body.description,
        color=body.color,
        kind="manual",
    )
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    return tag


@router.post("/import-from-entities", response_model=List[scheme.ScenarioTagOut])
async def import_tags_from_entities(
    scenario: models.Scenario = Depends(get_scenario_edit),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    """Create manual pool entries for ad-hoc keys found on entities."""
    existing = {
        t.key: t
        for t in (
            await db.execute(
                select(models.ScenarioTag).where(models.ScenarioTag.scenario_id == scenario.id)
            )
        )
        .scalars()
        .all()
    }
    found: set[str] = set()
    for model in (models.NPC, models.GameItem, models.PlayerCharacter, models.Location, models.StoryBeat, models.Note, models.Counter, models.Obstacle):
        rows = (
            await db.execute(select(model).where(model.scenario_id == scenario.id))
        ).scalars().all()
        for row in rows:
            tags = getattr(row, "tags", None) or []
            if isinstance(tags, list):
                for t in tags:
                    found.add(str(t))

    created = []
    for key in sorted(found):
        if not key or key in existing:
            continue
        if key.startswith("front_"):
            continue
        tag = models.ScenarioTag(
            scenario_id=scenario.id,
            key=key,
            label=key,
            description=None,
            color=None,
            kind="manual",
        )
        db.add(tag)
        created.append(tag)
        existing[key] = tag
    await db.commit()
    for t in created:
        await db.refresh(t)
    return list(existing.values())


@router.patch("/{tag_id}", response_model=scheme.ScenarioTagOut)
async def update_tag(
    tag_id: UUID,
    body: scheme.ScenarioTagUpdate,
    scenario: models.Scenario = Depends(get_scenario_edit),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    tag = await db.get(models.ScenarioTag, tag_id)
    if not tag or tag.scenario_id != scenario.id:
        raise HTTPException(status_code=404, detail="Tag not found")
    if tag.kind == "front" and body.key is not None and body.key != tag.key:
        raise HTTPException(status_code=400, detail="Cannot rename front tag key")

    data = body.model_dump(exclude_unset=True)
    if "key" in data and data["key"]:
        new_key = svc.slugify_key(data["key"])
        if new_key != tag.key:
            clash = (
                await db.execute(
                    select(models.ScenarioTag).where(
                        models.ScenarioTag.scenario_id == scenario.id,
                        models.ScenarioTag.key == new_key,
                        models.ScenarioTag.id != tag.id,
                    )
                )
            ).scalars().first()
            if clash:
                raise HTTPException(status_code=400, detail="Tag key already exists")
            old_key = tag.key
            tag.key = new_key
            # rewrite entity tags referencing old key
            for model in (models.NPC, models.GameItem, models.PlayerCharacter, models.Location, models.StoryBeat, models.Note, models.Counter, models.Obstacle):
                rows = (
                    await db.execute(select(model).where(model.scenario_id == scenario.id))
                ).scalars().all()
                for row in rows:
                    tags = list(getattr(row, "tags", None) or [])
                    if old_key in tags:
                        row.tags = [new_key if t == old_key else t for t in tags]
    if "label" in data and data["label"] is not None:
        tag.label = data["label"]
    if "description" in data:
        tag.description = data["description"]
    if "color" in data:
        tag.color = data["color"]

    await db.commit()
    await db.refresh(tag)
    return tag


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(
    tag_id: UUID,
    scenario: models.Scenario = Depends(get_scenario_edit),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    tag = await db.get(models.ScenarioTag, tag_id)
    if not tag or tag.scenario_id != scenario.id:
        raise HTTPException(status_code=404, detail="Tag not found")
    if tag.kind == "front":
        raise HTTPException(status_code=400, detail="Delete the Front to remove its tag")

    key = tag.key
    await db.delete(tag)
    # strip from entities
    for model in (models.NPC, models.GameItem, models.PlayerCharacter, models.Location, models.StoryBeat, models.Note, models.Counter, models.Obstacle):
        rows = (
            await db.execute(select(model).where(model.scenario_id == scenario.id))
        ).scalars().all()
        for row in rows:
            tags = list(getattr(row, "tags", None) or [])
            if key in tags:
                row.tags = [t for t in tags if t != key]
    await db.commit()
    return None
