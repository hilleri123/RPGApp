# plugins/gumshoe/contest/types.py
from __future__ import annotations
from typing import Optional, List, Literal
from uuid import UUID
from pydantic import BaseModel, Field, NonNegativeInt
from ...types import Skill, SkillGroup


ContestSide = Literal["a", "b"]


class ContestParticipant(BaseModel):
    # ЛИБО персонаж, ЛИБО NPC
    characterId: Optional[UUID] = None
    npcId:       Optional[UUID] = None
    name:        str = ""
    userId:      Optional[UUID] = None  # None если NPC (управляет GM)

    skill_points: NonNegativeInt = 0
    points_set:   bool = False          # уже указал кол-во поинтов?

    canvas_seed:  Optional[str] = None
    dice:         Optional[List[int]] = None
    roll_total:   Optional[int] = None  # dice[0] + skill_points

    difficulty: int = 4
    passed: Optional[bool] = None


class ContestRound(BaseModel):
    round_num: int
    skill_id:  str
    side_a:    ContestParticipant
    side_b:    ContestParticipant
    winner:    Optional[ContestSide] = None  # "a" | "b" | None (ничья)
    result_text: str = ""


class ContestEntry(BaseModel):
    skill_id: str = ""

    side_a: ContestParticipant = Field(default_factory=ContestParticipant)
    side_b: ContestParticipant = Field(default_factory=ContestParticipant)

    current_round: int = 1
    rounds: List[ContestRound] = Field(default_factory=list)

    # победитель всего состязания
    final_winner: Optional[ContestSide] = None


class ContestContext(BaseModel):
    sceneId: UUID
    entry:   ContestEntry = Field(default_factory=ContestEntry)
    skills: list[Skill]
    skillGroups: list[SkillGroup]
