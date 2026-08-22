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

router = APIRouter(prefix="/scenarios/{scenario_id}/fronts", tags=["fronts"])


@router.get("", response_model=List[scheme.FrontListItem])
async def list_fronts(
    scenario: models.Scenario = Depends(get_scenario_or_404),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(models.Front)
            .where(models.Front.scenario_id == scenario.id)
            .options(
                selectinload(models.Front.tag),
                selectinload(models.Front.members),
                selectinload(models.Front.wiki_notes),
            )
            .order_by(models.Front.name.asc())
        )
    ).scalars().all()
    notes = await svc.load_scenario_notes(db, scenario.id)
    return [scheme.FrontListItem.model_validate(svc.front_list_item(f, notes)) for f in rows]


@router.get("/{front_id}", response_model=scheme.FrontOut)
async def get_front(
    front_id: UUID,
    scenario: models.Scenario = Depends(get_scenario_or_404),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    front = await svc.load_front(db, scenario.id, front_id)
    if not front:
        raise HTTPException(status_code=404, detail="Front not found")
    notes = await svc.load_scenario_notes(db, scenario.id)
    return scheme.FrontOut.model_validate(svc.front_to_out(front, notes))


@router.post("", response_model=scheme.FrontOut, status_code=status.HTTP_201_CREATED)
async def create_front(
    body: scheme.FrontCreate,
    scenario: models.Scenario = Depends(get_scenario_edit),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    key = await svc.unique_tag_key(db, scenario.id, f"front_{body.name}")
    tag = models.ScenarioTag(
        scenario_id=scenario.id,
        key=key,
        label=body.name.strip() or key,
        description=f"Фронт: {body.name}",
        color=body.color,
        kind="front",
    )
    db.add(tag)
    await db.flush()

    front = models.Front(
        scenario_id=scenario.id,
        name=body.name.strip(),
        description_for_master=body.description_for_master,
        color=body.color or "#7c3aed",
        icon_url=str(body.icon_url) if body.icon_url else None,
        tag_id=tag.id,
    )
    db.add(front)
    await db.flush()
    tag.front_id = front.id
    await db.commit()

    front = await svc.load_front(db, scenario.id, front.id)
    await notify_active_sessions_for_scenario(db, scenario, ["fronts", "scenario_tags"])
    return scheme.FrontOut.model_validate(svc.front_to_out(front, await svc.load_scenario_notes(db, scenario.id)))


@router.patch("/{front_id}", response_model=scheme.FrontOut)
async def update_front(
    front_id: UUID,
    body: scheme.FrontUpdate,
    scenario: models.Scenario = Depends(get_scenario_edit),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    front = await svc.load_front(db, scenario.id, front_id)
    if not front:
        raise HTTPException(status_code=404, detail="Front not found")

    data = body.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        front.name = data["name"]
        if front.tag:
            front.tag.label = data["name"]
    if "description_for_master" in data:
        front.description_for_master = data["description_for_master"]
    if "color" in data and data["color"] is not None:
        front.color = data["color"]
        if front.tag:
            front.tag.color = data["color"]
    if "icon_url" in data:
        front.icon_url = str(data["icon_url"]) if data["icon_url"] else None

    await db.commit()
    front = await svc.load_front(db, scenario.id, front_id)
    await notify_active_sessions_for_scenario(db, scenario, ["fronts"])
    return scheme.FrontOut.model_validate(svc.front_to_out(front, await svc.load_scenario_notes(db, scenario.id)))


@router.delete("/{front_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_front(
    front_id: UUID,
    scenario: models.Scenario = Depends(get_scenario_edit),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    front = await svc.load_front(db, scenario.id, front_id)
    if not front:
        raise HTTPException(status_code=404, detail="Front not found")

    tag = front.tag
    tag_key = tag.key if tag else None
    if tag_key:
        for m in list(front.members or []):
            await svc.sync_member_tag(
                db,
                scenario_id=scenario.id,
                entity_type=m.entity_type,
                entity_id=m.entity_id,
                tag_key=tag_key,
                add=False,
            )

    tag_id = front.tag_id
    await db.delete(front)
    await db.flush()
    if tag_id:
        tag_row = await db.get(models.ScenarioTag, tag_id)
        if tag_row:
            await db.delete(tag_row)
    await db.commit()
    await notify_active_sessions_for_scenario(db, scenario, ["fronts", "scenario_tags"])
    return None


@router.post("/{front_id}/members", response_model=scheme.FrontOut)
async def add_member(
    front_id: UUID,
    body: scheme.FrontMemberIn,
    scenario: models.Scenario = Depends(get_scenario_edit),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    try:
        svc.assert_entity_type(body.entity_type)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    front = await svc.load_front(db, scenario.id, front_id)
    if not front:
        raise HTTPException(status_code=404, detail="Front not found")

    entity = await svc.get_entity(
        db, scenario_id=scenario.id, entity_type=body.entity_type, entity_id=body.entity_id
    )
    if entity is None or getattr(entity, "scenario_id", None) != scenario.id:
        raise HTTPException(status_code=404, detail="Entity not found in scenario")

    exists = next(
        (
            m
            for m in (front.members or [])
            if m.entity_type == body.entity_type and m.entity_id == body.entity_id
        ),
        None,
    )
    if not exists:
        db.add(
            models.FrontMember(
                front_id=front.id,
                entity_type=body.entity_type,
                entity_id=body.entity_id,
            )
        )
        tag_key = front.tag.key if front.tag else None
        if tag_key:
            await svc.sync_member_tag(
                db,
                scenario_id=scenario.id,
                entity_type=body.entity_type,
                entity_id=body.entity_id,
                tag_key=tag_key,
                add=True,
            )
        await db.commit()

    front = await svc.load_front(db, scenario.id, front_id)
    await notify_active_sessions_for_scenario(db, scenario, ["fronts", "npcs", "items", "counters", "story_beats", "locations"])
    return scheme.FrontOut.model_validate(svc.front_to_out(front, await svc.load_scenario_notes(db, scenario.id)))


@router.delete("/{front_id}/members/{member_id}", response_model=scheme.FrontOut)
async def remove_member(
    front_id: UUID,
    member_id: UUID,
    scenario: models.Scenario = Depends(get_scenario_edit),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    front = await svc.load_front(db, scenario.id, front_id)
    if not front:
        raise HTTPException(status_code=404, detail="Front not found")

    member = next((m for m in (front.members or []) if m.id == member_id), None)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    tag_key = front.tag.key if front.tag else None
    if tag_key:
        await svc.sync_member_tag(
            db,
            scenario_id=scenario.id,
            entity_type=member.entity_type,
            entity_id=member.entity_id,
            tag_key=tag_key,
            add=False,
        )
    await db.delete(member)
    await db.commit()

    front = await svc.load_front(db, scenario.id, front_id)
    await notify_active_sessions_for_scenario(db, scenario, ["fronts", "npcs", "items", "counters", "story_beats", "locations"])
    return scheme.FrontOut.model_validate(svc.front_to_out(front, await svc.load_scenario_notes(db, scenario.id)))


@router.post("/{front_id}/wiki-notes", response_model=scheme.FrontOut)
async def link_wiki_note(
    front_id: UUID,
    body: scheme.FrontWikiNoteIn,
    scenario: models.Scenario = Depends(get_scenario_edit),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    front = await svc.load_front(db, scenario.id, front_id)
    if not front:
        raise HTTPException(status_code=404, detail="Front not found")

    note = await db.get(models.Note, body.note_id)
    if not note or note.scenario_id != scenario.id:
        raise HTTPException(status_code=404, detail="Note not found")
    if not svc.is_master_wiki_note(note):
        raise HTTPException(status_code=400, detail="Note must be a master_wiki note")

    exists = next((w for w in (front.wiki_notes or []) if w.note_id == body.note_id), None)
    if not exists:
        db.add(
            models.FrontWikiNote(
                front_id=front.id,
                note_id=body.note_id,
                sort_order=body.sort_order,
            )
        )
        await db.commit()

    front = await svc.load_front(db, scenario.id, front_id)
    await notify_active_sessions_for_scenario(db, scenario, ["fronts"])
    return scheme.FrontOut.model_validate(svc.front_to_out(front, await svc.load_scenario_notes(db, scenario.id)))


@router.delete("/{front_id}/wiki-notes/{link_id}", response_model=scheme.FrontOut)
async def unlink_wiki_note(
    front_id: UUID,
    link_id: UUID,
    scenario: models.Scenario = Depends(get_scenario_edit),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    front = await svc.load_front(db, scenario.id, front_id)
    if not front:
        raise HTTPException(status_code=404, detail="Front not found")

    link = next((w for w in (front.wiki_notes or []) if w.id == link_id), None)
    if not link:
        raise HTTPException(status_code=404, detail="Wiki link not found")
    await db.delete(link)
    await db.commit()

    front = await svc.load_front(db, scenario.id, front_id)
    await notify_active_sessions_for_scenario(db, scenario, ["fronts"])
    return scheme.FrontOut.model_validate(svc.front_to_out(front, await svc.load_scenario_notes(db, scenario.id)))
