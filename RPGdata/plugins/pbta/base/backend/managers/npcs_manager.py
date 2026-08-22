from __future__ import annotations
from typing import Any
from pydantic import ValidationError
from plugins.common.types import ValidateResult, ValidationIssue
from plugins.common.protocols import PluginPayload
from ..codex import PbtaFullCodex


class NpcsManager:
    kind = "npc"

    def __init__(self, full_codex: PbtaFullCodex) -> None:
        pass

    def config(self, context: dict[str, Any] | None = None) -> dict[str, Any]:
        return {}

    def validate_and_enrich(self, payload: dict[str, Any], context: dict[str, Any] | None = None) -> ValidateResult:
        result = PluginPayload(
            data=payload,
            tags=payload["tags"]
        )
        return ValidateResult(ok=True, issues=[], result=result)
