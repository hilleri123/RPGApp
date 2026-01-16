from __future__ import annotations
from typing import Any
from pydantic import ValidationError
from .types import ItemData, ValidateResult, ValidationIssue

class ItemsManager:
    kind = "item"

    def config(self, context: dict[str, Any] | None = None) -> dict[str, Any]:
        return {
            "tags": ["weapon", "armor", "consumable", "misc"],
            "defaults": {"weight": 0},
        }

    def validate_and_enrich(self, payload: dict[str, Any], context: dict[str, Any] | None = None) -> ValidateResult:
        try:
            item = ItemData.model_validate(payload) if hasattr(ItemData, "model_validate") else ItemData.parse_obj(payload)
        except ValidationError as e:
            issues = [
                ValidationIssue(
                    path="data." + ".".join(str(x) for x in err.get("loc", [])),
                    message=err.get("msg", "Invalid"),
                    icon="error",
                    level="error",
                )
                for err in e.errors()
            ]
            return ValidateResult(ok=False, issues=issues, data=None)

        # enrich пример: нормализуем kind
        data = item.model_dump() if hasattr(item, "model_dump") else item.dict()
        return ValidateResult(ok=True, issues=[], data=data)
