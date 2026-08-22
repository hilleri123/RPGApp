from __future__ import annotations
from typing import Any, Protocol, Literal, Optional, runtime_checkable
from pydantic import BaseModel, Field, NonNegativeInt, PositiveInt



class CharacterData(BaseModel):
    profession: str
    tokens: NonNegativeInt = 0

