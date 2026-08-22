from __future__ import annotations
from typing import Any, Protocol, Literal, Optional, runtime_checkable
from pydantic import BaseModel, Field, NonNegativeInt

from .items import ItemData


class CharacterPoints(BaseModel):
    investigativeMax: NonNegativeInt = 0
    generalMax: NonNegativeInt = 0


class CharacterInjury(BaseModel):
    level: NonNegativeInt = 0
    tags: list[str] = Field(default_factory=list)
    text: str


class CharacterData(BaseModel):
    hit_difficulty: NonNegativeInt = 4

    skills: dict[str, int] = Field(default_factory=dict)
    initial_skills: dict[str, int] = Field(default_factory=dict)
    bonus_skills: dict[str, int] = Field(default_factory=dict)

    points: CharacterPoints = Field(default_factory=CharacterPoints)

    injuries: list[CharacterInjury] = Field(default_factory=list)