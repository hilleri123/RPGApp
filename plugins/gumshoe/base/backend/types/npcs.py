from __future__ import annotations
from typing import Any, Protocol, Literal, Optional, runtime_checkable
from pydantic import BaseModel, Field, NonNegativeInt, PositiveInt

from .items import HasItems



class NpcData(HasItems, BaseModel):

    # NPC: только general (валидация на уровне NpcsManager)
    skills: dict[str, NonNegativeInt] = Field(default_factory=dict)

    # боевые/служебные поля опционально
    health: Optional[NonNegativeInt] = None
    stability: Optional[NonNegativeInt] = None
    armor: Optional[NonNegativeInt] = None
    hitThreshold: Optional[PositiveInt] = None
