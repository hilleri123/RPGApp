# types/obstacle.py
from __future__ import annotations

from typing import Annotated, Literal, Union
from pydantic import BaseModel, Field, NonNegativeInt, PositiveInt


class ObstacleClue(BaseModel):
    type: Literal["clue"] = "clue"
    investigative_skills: list[str] = Field(default_factory=list)
    spend_cost: NonNegativeInt = 0
    reward: str = ""


class ObstacleChallenge(BaseModel):
    type: Literal["challenge"] = "challenge"
    general_skill: str = ""
    difficulty: PositiveInt = 4
    on_success: str = ""
    on_fail: str = ""


ObstacleData = Annotated[
    Union[ObstacleClue, ObstacleChallenge],
    Field(discriminator="type"),
]
