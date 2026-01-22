from __future__ import annotations
from typing import Any, Protocol, Literal, Optional, runtime_checkable
from pydantic import BaseModel, Field, NonNegativeInt

from .items import ItemData


class CharacterPoints(BaseModel):
    investigativeMax: NonNegativeInt = 0
    generalMax: NonNegativeInt = 0


class CharacterData(BaseModel):
    name: str = ""
    skills: dict[str, NonNegativeInt] = Field(default_factory=dict)

    # храни как список ItemData, а не list[dict] — иначе ItemsManager не сможет нормально переиспользоваться
    items: list[ItemData] = Field(default_factory=list)

    points: CharacterPoints = Field(default_factory=CharacterPoints)
