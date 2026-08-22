from __future__ import annotations
from typing import Any, Protocol, Literal, Optional, runtime_checkable
from pydantic import BaseModel, Field, NonNegativeInt, ConfigDict




class Skill(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    title: str
    color: str