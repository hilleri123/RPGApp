# scenes_manager.py
from __future__ import annotations

from typing import Any

from pydantic import ValidationError

from plugins.common.types import ValidateResult, ValidationIssue, PluginPayload


class ScenesManager:
    kind = "scene"

    def config(self, context: dict[str, Any] = None) -> dict[str, Any]:
        return {
            "initialData": self.init(context),
            "constraints": {},
        }

    def init(self, context: dict[str, Any] = None) -> dict[str, Any]:
        return {}

    def validate_and_enrich(
        self,
        payload: PluginPayload,
        context: dict[str, Any] = None,
    ) -> ValidateResult:
        result = PluginPayload(
            data=payload["data"],
            tags=payload["tags"]
        )
        return ValidateResult(ok=True, issues=[], result=result)
