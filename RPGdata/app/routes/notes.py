# app/routes/scenarios/notes.py
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.infrastructure.database import get_async_session as get_db
from app import models, scheme
from app.auth import require_master
from app.routes._helpers import get_scenario_or_404, get_scenario_edit, notify_active_sessions_for_scenario

router = APIRouter(prefix="/scenarios/{scenario_id}/notes", tags=["notes"])


async def _assert_valid_parent(
    db: AsyncSession,
    *,
    scenario_id: UUID,
    note_id: UUID | None,
    parent_note_id: UUID | None,
) -> None:
    if parent_note_id is None:
        return
    if note_id is not None and parent_note_id == note_id:
        raise HTTPException(status_code=400, detail="Заметка не может быть родителем самой себя")

    parent = (
        await db.execute(
            select(models.Note).where(
                models.Note.id == parent_note_id,
                models.Note.scenario_id == scenario_id,
            )
        )
    ).scalars().first()
    if not parent:
        raise HTTPException(status_code=400, detail="Родительская заметка не найдена")

    if note_id is None:
        return

    # Walk ancestors of parent; note_id must not appear (cycle).
    cursor = parent
    seen: set[UUID] = set()
    while cursor is not None:
        if cursor.id == note_id:
            raise HTTPException(status_code=400, detail="Нельзя сделать заметку потомком самой себя")
        if cursor.id in seen:
            break
        seen.add(cursor.id)
        if cursor.parent_note_id is None:
            break
        cursor = (
            await db.execute(
                select(models.Note).where(
                    models.Note.id == cursor.parent_note_id,
                    models.Note.scenario_id == scenario_id,
                )
            )
        ).scalars().first()


@router.get("", response_model=list[scheme.Note])
async def list_notes(
    scenario: models.Scenario = Depends(get_scenario_or_404),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models.Note).where(models.Note.scenario_id == scenario.id)
    )
    return result.scalars().all()

@router.get("/{note_id}", response_model=scheme.Note)
async def get_by_id(
    note_id: UUID,
    scenario: models.Scenario = Depends(get_scenario_or_404),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models.Note)
        .where(models.Note.scenario_id == scenario.id)
        .where(models.Note.id == note_id)
    )
    note = result.scalars().first()
    if not note:
        raise HTTPException(status_code=404, detail="Заметка не найдена")
    return note

@router.post("", response_model=scheme.Note)
async def create_note(
    note_in: scheme.NoteCreate,
    scenario: models.Scenario = Depends(get_scenario_edit),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    # проверим сценарий на всякий
    res = await db.execute(select(models.Scenario).where(models.Scenario.id == scenario.id))
    scenario = res.scalars().first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Сценарий не найден")

    await _assert_valid_parent(
        db,
        scenario_id=scenario.id,
        note_id=None,
        parent_note_id=note_in.parent_note_id,
    )

    db_note = models.Note(
        **note_in.model_dump(exclude=["is_checked"], mode="json"),
        scenario_id=scenario.id,
    )
    db.add(db_note)
    await db.commit()
    await db.refresh(db_note)
    await notify_active_sessions_for_scenario(db, scenario, ["notes"])
    return db_note

@router.put("/{note_id}", response_model=scheme.Note)
async def update_note(
    note_id: UUID,
    note_in: scheme.NoteCreate,
    scenario: models.Scenario = Depends(get_scenario_edit),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    # Зависимости роутов проверяют права на сценарий из запроса, а не на
    # сущность. Без фильтра по scenario_id мастер сценария A правил бы
    # сущность сценария B, подставив свой scenario_id и чужой id.
    res = await db.execute(
        select(models.Note).where(
            models.Note.id == note_id,
            models.Note.scenario_id == scenario.id,
        )
    )
    db_note = res.scalars().first()
    if not db_note:
        raise HTTPException(status_code=404, detail="Заметка не найдена")

    data = note_in.model_dump(exclude_unset=True, mode="json")
    parent_id = data.get("parent_note_id", db_note.parent_note_id)
    if "parent_note_id" in data or parent_id is not None:
        await _assert_valid_parent(
            db,
            scenario_id=scenario.id,
            note_id=note_id,
            parent_note_id=parent_id,
        )

    for k, v in data.items():
        if k == "is_checked":
            continue
        setattr(db_note, k, v)
    await db.commit()
    await db.refresh(db_note)
    await notify_active_sessions_for_scenario(db, scenario, ["notes"])
    return db_note

@router.delete("/{note_id}", status_code=204)
async def delete_note(
    note_id: UUID,
    scenario: models.Scenario = Depends(get_scenario_edit),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    # Зависимости роутов проверяют права на сценарий из запроса, а не на
    # сущность. Без фильтра по scenario_id мастер сценария A правил бы
    # сущность сценария B, подставив свой scenario_id и чужой id.
    res = await db.execute(
        select(models.Note).where(
            models.Note.id == note_id,
            models.Note.scenario_id == scenario.id,
        )
    )
    db_note = res.scalars().first()
    if not db_note:
        raise HTTPException(status_code=404, detail="Заметка не найдена")

    from app.services.entity_lineage_service import assert_launched_entity_deletable

    try:
        assert_launched_entity_deletable(scenario, db_note)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    await db.delete(db_note)
    await db.commit()
    await notify_active_sessions_for_scenario(db, scenario, ["notes"])
    return None
