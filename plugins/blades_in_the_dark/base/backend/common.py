from __future__ import annotations

from typing import Any, Literal, Optional
from pydantic import BaseModel

# Контракт такой же, как в твоём примере
EntityKind = Literal["character", "npc", "item", "location", "obstacle"]  # [file:1]

class ValidationIssue(BaseModel):
    path: str
    message: str
    icon: Optional[str] = None
    level: Literal["error", "warning"] = "error"

class ValidateResult(BaseModel):
    ok: bool
    issues: list[ValidationIssue] = []
    data: Optional[Any] = None
