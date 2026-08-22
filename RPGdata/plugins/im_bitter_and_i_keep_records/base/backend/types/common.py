from __future__ import annotations
from typing import Any, Protocol, Literal, Optional, runtime_checkable
from pydantic import BaseModel, Field, NonNegativeInt

EntityKind = Literal["character", "npc", "item", "location", "obstacle"]



class ValidationIssue(BaseModel):
    path: str                  # "data.skills.athletics"
    message: str
    icon: Optional[str] = None    # "error" | "warn" | "dice"...
    level: Literal["error", "warning"] = "error"

class ValidateResult(BaseModel):
    ok: bool
    issues: list[ValidationIssue] = []
    data: Optional[Any] = None    # enriched data json
