from __future__ import annotations
from typing import Any, Protocol, Literal, Optional, runtime_checkable
from pydantic import BaseModel, Field, NonNegativeInt, ConfigDict


SkillKind = Literal["investigative", "general"]

class SkillGroup(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    title: str
    color: str

    kind: SkillKind


class Skill(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    title: str
    group: str

