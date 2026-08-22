from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database import get_async_session as get_db
from app.auth import require_master
from app import models
from app import scheme
from ._helpers import get_scenario_or_404, get_scenario_edit


router = APIRouter(prefix="/scenarios/{scenario_id}/todos", tags=["todos"])


# ---------------------------------------------------------------------------
# Утилиты
# ---------------------------------------------------------------------------

def _stmt_todo_list(
    scenario_id: UUID,
    element_type: Optional[models.TodoElementType],
    element_id: Optional[UUID],
    is_done: Optional[bool],
    priority: Optional[models.TodoPriority],
    skip: int,
    limit: int,
):
    stmt = (
        select(models.ScenarioTodo)
        .where(models.ScenarioTodo.scenario_id == scenario_id)
        .order_by(
            models.ScenarioTodo.is_done.asc(),          # сначала незавершённые
            models.ScenarioTodo.priority.desc(),        # high → medium → low
            models.ScenarioTodo.created_at.asc(),
        )
        .offset(skip)
        .limit(limit)
    )
    if element_type is not None:
        stmt = stmt.where(models.ScenarioTodo.element_type == element_type)
    if element_id is not None:
        stmt = stmt.where(models.ScenarioTodo.element_id == element_id)
    if is_done is not None:
        stmt = stmt.where(models.ScenarioTodo.is_done == is_done)
    if priority is not None:
        stmt = stmt.where(models.ScenarioTodo.priority == priority)
    return stmt


async def _get_todo_or_404(db: AsyncSession, todo_id: UUID, scenario_id: UUID) -> models.ScenarioTodo:
    obj = (await db.execute(
        select(models.ScenarioTodo).where(
            models.ScenarioTodo.id == todo_id,
            models.ScenarioTodo.scenario_id == scenario_id,
        )
    )).scalars().first()
    if not obj:
        raise HTTPException(status_code=404, detail="Todo не найден")
    return obj


# ---------------------------------------------------------------------------
# Эндпоинты
# ---------------------------------------------------------------------------

@router.get("", response_model=List[scheme.ScenarioTodoOut])
async def list_todos(
    skip:         int                        = 0,
    limit:        int                        = 200,
    element_type: Optional[models.TodoElementType] = Query(None),
    element_id:   Optional[UUID]            = Query(None),
    is_done:      Optional[bool]            = Query(None),
    priority:     Optional[models.TodoPriority]    = Query(None),
    scenario:     models.Scenario           = Depends(get_scenario_or_404),
    current_user: models.User               = Depends(require_master),
    db:           AsyncSession              = Depends(get_db),
):
    rows = (await db.execute(
        _stmt_todo_list(scenario.id, element_type, element_id, is_done, priority, skip, limit)
    )).scalars().all()
    return rows


@router.post("", response_model=scheme.ScenarioTodoOut, status_code=status.HTTP_201_CREATED)
async def create_todo(
    payload:      scheme.ScenarioTodoCreate,
    scenario:     models.Scenario = Depends(get_scenario_edit),
    current_user: models.User     = Depends(require_master),
    db:           AsyncSession    = Depends(get_db),
):
    obj = models.ScenarioTodo(
        **payload.model_dump(),
        scenario_id=scenario.id,
        is_done=False,
    )
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.get("/{todo_id}", response_model=scheme.ScenarioTodoOut)
async def get_todo(
    todo_id:      UUID,
    scenario:     models.Scenario = Depends(get_scenario_or_404),
    current_user: models.User     = Depends(require_master),
    db:           AsyncSession    = Depends(get_db),
):
    return await _get_todo_or_404(db, todo_id, scenario.id)


@router.patch("/{todo_id}", response_model=scheme.ScenarioTodoOut)
async def patch_todo(
    todo_id:      UUID,
    payload:      scheme.ScenarioTodoPatch,
    scenario:     models.Scenario = Depends(get_scenario_edit),
    current_user: models.User     = Depends(require_master),
    db:           AsyncSession    = Depends(get_db),
):
    obj = await _get_todo_or_404(db, todo_id, scenario.id)

    update = payload.model_dump(exclude_unset=True)

    # Если переключаем в done — фиксируем время
    if update.get("is_done") is True and not obj.is_done:
        update["done_at"] = datetime.now(timezone.utc)
    # Если снимаем отметку — сбрасываем время
    elif update.get("is_done") is False:
        update["done_at"] = None

    for k, v in update.items():
        setattr(obj, k, v)

    await db.commit()
    await db.refresh(obj)
    return obj


@router.post("/{todo_id}/done", response_model=scheme.ScenarioTodoOut)
async def mark_done(
    todo_id:      UUID,
    scenario:     models.Scenario = Depends(get_scenario_edit),
    current_user: models.User     = Depends(require_master),
    db:           AsyncSession    = Depends(get_db),
):
    """Быстрый toggle: если done → undone, если undone → done."""
    obj = await _get_todo_or_404(db, todo_id, scenario.id)
    obj.is_done = not obj.is_done
    obj.done_at = datetime.now(timezone.utc) if obj.is_done else None
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/{todo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_todo(
    todo_id:      UUID,
    scenario:     models.Scenario = Depends(get_scenario_edit),
    current_user: models.User     = Depends(require_master),
    db:           AsyncSession    = Depends(get_db),
):
    obj = await _get_todo_or_404(db, todo_id, scenario.id)
    await db.delete(obj)
    await db.commit()