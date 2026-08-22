# plugins/gumshoe/investigate_obstacle/types.py
from __future__ import annotations
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field

from ...types import ObstacleData


class SpendRecord(BaseModel):
    clue_spend_name: str       # имя ClueSpend из ObstacleData
    skill_name: str            # с какого навыка списывать
    cost: int                  # сколько очков
    info: str = ""             # текст, который покажется игроку после подтверждения
    confirmed: bool = False    # GM подтвердил
    revealed: bool = False     # текст уже был показан игроку


class InvestigateEntry(BaseModel):
    playerUserId: Optional[UUID] = None
    characterId: Optional[UUID] = None

    obstacle_id: Optional[UUID] = None      # <-- вместо индекса
    chosen_skill: Optional[str] = None

    spend_records: list[SpendRecord] = Field(default_factory=list)
    finished: bool = False


class InvestigateContext(BaseModel):
    sceneId: UUID
    obstacle: Optional[ObstacleData] = None
    entry: Optional[InvestigateEntry] = None
