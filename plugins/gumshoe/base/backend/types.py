from __future__ import annotations
from typing import Any, Protocol, Literal, Optional, runtime_checkable
from pydantic import BaseModel, Field, NonNegativeInt

EntityKind = Literal["character", "npc", "item"]



class ValidationIssue(BaseModel):
    path: str                  # "data.skills.athletics"
    message: str
    icon: Optional[str] = None    # "error" | "warn" | "dice"...
    level: Literal["error", "warning"] = "error"

class ValidateResult(BaseModel):
    ok: bool
    issues: list[ValidationIssue] = []
    data: Optional[Any] = None    # enriched data json

class ItemData(BaseModel):
    id: str
    name: str
    tags: list[str] = Field(default_factory=list)
    weight: float = 0

class HasItems(BaseModel):
    items: list[ItemData] = Field(default_factory=list)

class HasStats(BaseModel):
    skills: dict[str, int] = Field(default_factory=dict)



class CharacterPoints(BaseModel):
    investigativeMax: NonNegativeInt = 0
    generalMax: NonNegativeInt = 0


class CharacterData(BaseModel):
    name: str = ""
    skills: dict[str, NonNegativeInt] = Field(default_factory=dict)
    items: list[dict] = Field(default_factory=list)

    # Новое: бюджеты очков, которые задаёт мастер
    points: CharacterPoints = Field(default_factory=CharacterPoints)


class NpcData(HasItems, HasStats):
    name: str

@runtime_checkable
class EntityManager(Protocol):
    kind: EntityKind
    def config(self, context: dict[str, Any] | None = None) -> dict[str, Any]: ...
    def validate_and_enrich(self, payload: dict[str, Any], context: dict[str, Any] | None = None) -> ValidateResult: ...
