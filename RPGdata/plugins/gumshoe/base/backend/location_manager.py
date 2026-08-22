from __future__ import annotations
from typing import Any
from pydantic import ValidationError

from .types import CharacterData
from plugins.common.types import ValidateResult, ValidationIssue, PluginPayload

class LocationManager:
    kind = "location"

    def __init__(self) -> None:
        pass

    def config(self, context: dict[str, Any] | None = None) -> dict[str, Any]:
        return {}

    def validate_and_enrich(self, payload: PluginPayload, context: dict[str, Any] | None = None) -> ValidateResult:
        result = PluginPayload(
            data=payload["data"],
            tags=payload["tags"]
        )
        return ValidateResult(ok=True, issues=[], result=result)
