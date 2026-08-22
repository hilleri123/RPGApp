# plugins/gumshoe/task_bonus/types.py
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel
from uuid import UUID


class TaskBonusEntry(BaseModel):
    playerUserId: Optional[UUID] = None
    characterId: Optional[UUID] = None
    task_id: str = ''
    task_description: str = ''
    task_bonus: int = 0
    decision: Optional[str] = None     # 'approve' | 'reject'
    comment: Optional[str] = None


class TaskBonusContext(BaseModel):
    entry: Optional[TaskBonusEntry] = None