from __future__ import annotations

from pydantic import BaseModel, Field


class FreeDiceRollResult(BaseModel):
    roll_seed: str = ""
    dice: list[int] = Field(default_factory=list)
    total: int = 0
    expression: str = "1d6"


class FreeDiceContext(BaseModel):
    scene_id: str = ""
    actor_user_id: str = ""
    declaration: str = ""
    expression: str = "1d6"
    roll: FreeDiceRollResult | None = None
