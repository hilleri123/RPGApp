from __future__ import annotations
from typing import Any, Protocol, Literal, Optional, runtime_checkable
from pydantic import BaseModel, Field, NonNegativeInt



TagCategory = Literal["technique", "material", "tactic"]

class TagDef(BaseModel):
    id: str
    category: TagCategory
    title: str
    description: str = ""


