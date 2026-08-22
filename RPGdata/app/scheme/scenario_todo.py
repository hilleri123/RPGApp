from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel

from app.models.scenario.todo import TodoElementType, TodoPriority


class ScenarioTodoCreate(BaseModel):
    element_type: TodoElementType
    element_id:   Optional[UUID]   = None  # фронт передаёт, если знает к чему привязать
    element_name: Optional[str]    = None  # человекочитаемое имя (кеш для UI)
    text:         str
    note:         Optional[str]    = None
    priority:     TodoPriority     = TodoPriority.medium


class ScenarioTodoPatch(BaseModel):
    element_type: Optional[TodoElementType] = None
    element_id:   Optional[UUID]            = None
    element_name: Optional[str]             = None
    text:         Optional[str]             = None
    note:         Optional[str]             = None
    priority:     Optional[TodoPriority]    = None
    is_done:      Optional[bool]            = None


class ScenarioTodoOut(BaseModel):
    id:           UUID
    scenario_id:  UUID
    element_type: TodoElementType
    element_id:   Optional[UUID]
    element_name: Optional[str]
    text:         str
    note:         Optional[str]
    priority:     TodoPriority
    is_done:      bool
    done_at:      Optional[datetime]
    created_at:   datetime
    updated_at:   datetime

    model_config = {"from_attributes": True}