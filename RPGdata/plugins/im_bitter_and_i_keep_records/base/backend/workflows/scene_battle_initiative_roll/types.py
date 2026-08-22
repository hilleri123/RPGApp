from __future__ import annotations

from typing import Literal, Optional, List
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class InitiativeRollInput(BaseModel):
    result: int

    @field_validator("result")
    @classmethod
    def _rng(cls, v: int) -> int:
        if v < 1 or v > 20:
            raise ValueError("result must be in 1..20")
        return v


class InitEntry(BaseModel):
    entityId: UUID
    kind: Literal["pc", "npc"]
    name: str = ""
    ownerUserId: Optional[UUID] = None
    rolled: bool = False
    result: Optional[int] = None

class Roller(BaseModel):
    userId: UUID
    entityId: UUID   # персонаж (или npc)
    name: str = ""

class InitiativeWorkflowContext(BaseModel):
    sceneId: UUID
    order: List[InitEntry] = Field(default_factory=list)
    currentIndex: int = 0

    rollers: List[Roller] = Field(default_factory=list)   # <-- НОВОЕ

    def seek_next_unrolled(self) -> None:
        i = self.currentIndex
        while i < len(self.order) and self.order[i].rolled:
            i += 1
        self.currentIndex = i

    @property
    def is_done(self) -> bool:
        return self.currentIndex >= len(self.order)

    @property
    def current_entry(self) -> Optional[InitEntry]:
        if self.currentIndex < 0 or self.currentIndex >= len(self.order):
            return None
        return self.order[self.currentIndex]
