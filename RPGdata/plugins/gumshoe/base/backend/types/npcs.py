from __future__ import annotations
from typing import Any, Protocol, Literal, Optional, runtime_checkable
from pydantic import BaseModel, Field, NonNegativeInt, PositiveInt

from .items import HasItems



class NPCAttack(BaseModel):
    name: str
    attack_dmg: str
    attack_skill: str


class NpcData(HasItems, BaseModel):

    # NPC: только general (валидация на уровне NpcsManager)
    skills: dict[str, int] = Field(default_factory=dict)

    # боевые/служебные поля опционально
    armor: Optional[NonNegativeInt] = None
    hitThreshold: Optional[PositiveInt] = 4

    attacks: list[NPCAttack] = Field(default_factory=list)
