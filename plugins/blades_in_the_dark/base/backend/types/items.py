from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field, NonNegativeInt

class ItemData(BaseModel):
    tags: list[str] = Field(default_factory=list)

    # Ровно одна характеристика
    quality: Optional[NonNegativeInt] = None
