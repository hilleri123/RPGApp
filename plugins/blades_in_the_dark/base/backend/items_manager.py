from __future__ import annotations

from typing import Any

from pydantic import ValidationError

from .common import ValidateResult, ValidationIssue
from .types import ItemData

class ItemsManager:
    kind = "item"

    def config(self, context: dict[str, Any] | None = None) -> dict[str, Any]:
        return {
            "tags": ["gear", "weapon", "tool", "arcane", "misc"],
            "constraints": {
                # можно использовать фронтом как подсказку, но валидация ниже — по факту
                "qualityMin": 0,
            },
            "initialData": {
                "id": "",
                "name": "",
                "description": "",
                "tags": [],
                "quality": None,
            },
        }

    def validate_and_enrich(self, payload: dict[str, Any], context: dict[str, Any] | None = None) -> ValidateResult:
        ctx = context or {}
        issues: list[ValidationIssue] = []

        try:
            item = ItemData.model_validate(payload) if hasattr(ItemData, "model_validate") else ItemData.parse_obj(payload)
        except ValidationError as e:
            for err in e.errors():
                loc = ".".join(str(x) for x in err.get("loc", []))
                issues.append(ValidationIssue(path=f"data.{loc}" if loc else "data", message=err.get("msg", "Invalid"), icon="error"))
            return ValidateResult(ok=False, issues=issues, data=None)

        data = item.model_dump() if hasattr(item, "model_dump") else item.dict()

        # Нормализация tags: strip + unique (как у тебя в items_manager.py)
        tags = []
        seen = set()
        for t in data.get("tags", []) or []:
            tt = (t or "").strip()
            if tt and tt not in seen:
                seen.add(tt)
                tags.append(tt)
        data["tags"] = tags

        # quality может оставаться None — чтобы “автодобавление” делалось на уровне персонажа
        # (или ты можешь тут тоже автоподставлять, если хочешь единообразно)
        if data.get("quality") is not None and data["quality"] < 0:
            issues.append(ValidationIssue(path="data.quality", message="quality must be >= 0", icon="error"))

        if issues:
            return ValidateResult(ok=False, issues=issues, data=None)

        return ValidateResult(ok=True, issues=[], data=data)
