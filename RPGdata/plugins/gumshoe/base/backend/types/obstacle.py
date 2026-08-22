# types/obstacle.py
from __future__ import annotations

from uuid import UUID, uuid4
from typing import Annotated, Literal, Union
from pydantic import BaseModel, Field, NonNegativeInt, PositiveInt


class ClueSpend(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    name: str
    # сколько GUMSHOE‑очков надо потратить
    cost: NonNegativeInt = 1
    info: str = ""
    purchased_by: list[UUID] = Field(default_factory=list)  # кто купил


class ObstacleData(BaseModel):
    investigative_skills: list[str] = Field(default_factory=list)

    # базовый текст за сам факт наличия скилла
    base_text: str = ""

    # уровни за spend’ы
    spends: list[ClueSpend] = Field(default_factory=list)


