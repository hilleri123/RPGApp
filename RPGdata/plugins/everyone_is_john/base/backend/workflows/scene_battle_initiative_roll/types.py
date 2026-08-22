from __future__ import annotations

from typing import Literal, Optional, List
from uuid import UUID

from pydantic import BaseModel, Field, NonNegativeInt, field_validator


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
    name: str = ""
    ownerUserId: Optional[UUID] = None

    # новое
    available_tokens: NonNegativeInt = 0
    spend_tokens: Optional[NonNegativeInt] = None    # ставка жетонов (>=0)
    tieRolled: bool = False             # кидали ли d20 для тай-брейка
    tieResult: Optional[NonNegativeInt] = None     # результат d20 (1..20) или None
    canvas_seed: Optional[str] = None


class Roller(BaseModel):
    userId: UUID
    entityId: UUID   # персонаж (или npc)
    name: str = ""

class InitiativeWorkflowContext(BaseModel):
    sceneId: UUID
    order: List[InitEntry] = Field(default_factory=list)
    currentIndex: int = 0
    rollers: List[Roller] = Field(default_factory=list)

    # новое: кто участвует в тай-брейке
    tieEntityIds: List[UUID] = Field(default_factory=list)

    def seek_next_unrolled(self) -> None:
        i = self.currentIndex
        while i < len(self.order):
            e = self.order[i]
            # пропускаем тех, кто не в tie и/или уже кинул
            if (e.entityId in set(self.tieEntityIds)) and (not e.tieRolled):
                break
            i += 1
        self.currentIndex = i

