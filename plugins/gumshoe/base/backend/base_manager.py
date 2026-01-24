from __future__ import annotations
from typing import Any, Protocol, Literal, Optional, runtime_checkable
from pydantic import BaseModel, Field, NonNegativeInt
from .types import EntityKind, ValidateResult


@runtime_checkable
class EntityManager(Protocol):
    kind: EntityKind
    def config(self, context: dict[str, Any] | None = None) -> dict[str, Any]: ...
    def validate_and_enrich(self, payload: dict[str, Any], context: dict[str, Any] | None = None) -> ValidateResult: ...
