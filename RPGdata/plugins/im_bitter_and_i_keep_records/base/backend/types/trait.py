from __future__ import annotations
from typing import Any, Protocol, Literal, Optional, runtime_checkable
from pydantic import BaseModel, Field, NonNegativeInt



class Trait(BaseModel):
    id: str = ""
    text: str  # "когда X — я обязан Y, иначе плачу цену"
    meta: dict[str, Any] = Field(default_factory=dict)
