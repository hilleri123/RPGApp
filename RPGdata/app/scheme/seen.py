"""Player seen state schemas."""

from __future__ import annotations

import enum
from uuid import UUID

from pydantic import BaseModel, Field


class SeenDataAccess(str, enum.Enum):
    """How much entity payload a player may view after discovery."""

    NONE = "none"
    FULL = "full"


class PlayerSeenEntry(BaseModel):
    entity_type: str
    entity_id: UUID
    data_access: SeenDataAccess = Field(default=SeenDataAccess.NONE)
