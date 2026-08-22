from __future__ import annotations
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field


class TerrifyTarget(BaseModel):
    characterId: UUID
    userId: UUID
    name: str = ""
    dice: Optional[int] = None
    total: Optional[int] = None
    passed: Optional[bool] = None
    spent_stability: int = 0
    stability_loss: int = 0
    canvas_seed: Optional[str] = None


class TerrifyContext(BaseModel):
    sceneId: UUID
    damage: int = 0
    targets: List[TerrifyTarget] = Field(default_factory=list)
