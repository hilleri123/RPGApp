from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class LevelUpEntry(BaseModel):
    player_user_id: UUID
    character_id: UUID
    character_name: str = ""
    level: int = 1
    xp: int = 0
    xp_cost: int = 8
    chosen_stat_id: Optional[str] = None
    chosen_move_id: Optional[str] = None
    custom_move: Optional[dict[str, Any]] = None
    gm_comment: str = ""
    summary: str = ""


class LevelUpContext(BaseModel):
    scene_id: UUID
    entry: LevelUpEntry
