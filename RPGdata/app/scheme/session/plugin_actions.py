from __future__ import annotations

from typing import Any, Optional
from uuid import UUID
from pydantic import BaseModel, Field

from plugins.common.types import ActionParticipants

from .scene import Scene
from ..player import Player


class ActionRecord(BaseModel):
    id: UUID
    actionKey: str
    can_close: bool = False
    status: str = "active"
    tags: Optional[list[str]] = None
    scene_id: UUID
    participants: ActionParticipants = Field(default_factory=ActionParticipants)
    participantIds: list[UUID] = Field(default_factory=list)
    workflow: dict[str, Any] = Field(default_factory=dict)

    issues: list[dict[str, Any]] = Field(default_factory=list)
    lastError: Optional[dict[str, Any]] = None
    sessionPatch: Optional[dict[str, Any]] = None

