from __future__ import annotations
from typing import Any
from pydantic import ValidationError

from .types import CharacterData, ValidateResult, ValidationIssue

class LocationManager:
    kind = "location"

    def __init__(self) -> None:
        pass

    def config(self, context: dict[str, Any] | None = None) -> dict[str, Any]:
        return {}

    def validate_and_enrich(self, payload: dict[str, Any], context: dict[str, Any] | None = None) -> ValidateResult:
        return ValidateResult(ok=True, issues=[], data=payload)
