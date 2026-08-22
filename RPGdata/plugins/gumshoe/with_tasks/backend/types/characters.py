from __future__ import annotations
from typing import Any, Protocol, Literal, Optional, runtime_checkable
from pydantic import BaseModel, Field, NonNegativeInt


from ....base.backend.types import CharacterData as BaseCharacterData


class TaskBonusDefinition(BaseModel):
    """Описание задания — хранится в CharacterData.tasks"""
    id: str                        # уникальный ключ задания, напр. "kill_robot"
    description: str               # текст задания
    bonus: int                     # сколько бонусов получит игрок


class TaskBonusRecord(BaseModel):
    """Факт выполнения задания — записывается в CharacterData.bonuses"""
    task_id: Optional[str] = None
    description: str
    bonus: int
    confirmed_at: Optional[str] = None   # ISO datetime


class CharacterData(BaseCharacterData):
    tasks: list[TaskBonusDefinition] = Field(default_factory=list)  # задания
    bonuses: list[TaskBonusRecord] = Field(default_factory=list)     # выполненные