"""Synchronized entity presentation for scene participants and observers."""

from __future__ import annotations

from typing import Any, Literal, Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field

from app.scheme.seen import SeenDataAccess

PresentedEntityType = Literal["npc", "game_item", "player_character", "location"]


class PresentedEntityView(BaseModel):
    presentation_id: UUID = Field(default_factory=uuid4)
    scene_id: UUID
    entity_type: PresentedEntityType
    entity: dict[str, Any]
    data_access: SeenDataAccess = SeenDataAccess.NONE
