from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class RollRecordOut(BaseModel):
    id: UUID
    session_id: UUID
    user_id: UUID
    action_id: Optional[UUID] = None
    action_key: Optional[str] = None
    roll_kind: str = "dice.roll"
    system_id: Optional[str] = None
    title: Optional[str] = None
    expression: Optional[str] = None
    dice: list[int] = Field(default_factory=list)
    total: Optional[int] = None
    outcome: Optional[str] = None
    seed_hash: Optional[str] = None
    seed_image_url: Optional[str] = None
    meta: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime

    model_config = {"from_attributes": True}


class RollStatsOut(BaseModel):
    total_rolls: int = 0
    by_kind: dict[str, int] = Field(default_factory=dict)
    avg_total: Optional[float] = None
    with_seed_image: int = 0


class RollListOut(BaseModel):
    items: list[RollRecordOut]
    stats: RollStatsOut
    total: int
    skip: int
    limit: int
