from __future__ import annotations

from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class PrepareSpellsEntry(BaseModel):
    player_user_id: UUID
    character_id: UUID
    character_name: str = ""
    # Draft: [{id, prepared, amount}]
    prepared_draft: list[dict] = Field(default_factory=list)
    comment: str = ""
    decision: Optional[str] = None  # approve | reject


class PrepareSpellsContext(BaseModel):
    scene_id: UUID
    entry: PrepareSpellsEntry
