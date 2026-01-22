from __future__ import annotations
from typing import Any
from pydantic import ValidationError
from .types import ItemData, ValidateResult, ValidationIssue


class ItemsManager:
    kind = "item"

    def config(self, context: dict[str, Any] | None = None) -> dict[str, Any]:
        return {
            "tags": ["weapon", "armor", "consumable", "misc"],
            "initialData": {
                "id": "",
                "name": "",
                "description": "",
                "tags": [],
                "weight": None,
                "weapon": None,
                "armor": None,
            },
        }

    def validate_and_enrich(self, payload: dict[str, Any], context: dict[str, Any] | None = None) -> ValidateResult:
        issues: list[ValidationIssue] = []

        try:
            item = ItemData.model_validate(payload) if hasattr(ItemData, "model_validate") else ItemData.parse_obj(payload)
        except ValidationError as e:
            for err in e.errors():
                loc = ".".join(str(x) for x in err.get("loc", []))
                issues.append(ValidationIssue(path=f"data.{loc}" if loc else "data", message=err.get("msg", "Invalid"), icon="error"))
            return ValidateResult(ok=False, issues=issues, data=None)

        # semantic checks
        if item.weapon is None and item.armor is None:
            # не ошибка: предмет может быть “misc”
            pass

        if item.weapon is not None:
            if not item.weapon.damage.strip():
                issues.append(ValidationIssue(path="data.weapon.damage", message="Damage is required for weapon", icon="error"))

        if item.armor is not None:
            # rating уже NonNegativeInt
            if item.armor.vs and "all" in item.armor.vs and len(item.armor.vs) > 1:
                issues.append(ValidationIssue(path="data.armor.vs", message='If "all" is set, do not mix with other values', icon="error"))

        if issues:
            return ValidateResult(ok=False, issues=issues, data=None)

        data = item.model_dump() if hasattr(item, "model_dump") else item.dict()

        # normalize tags: strip + unique
        tags = []
        seen = set()
        for t in data.get("tags", []) or []:
            tt = (t or "").strip()
            if tt and tt not in seen:
                seen.add(tt)
                tags.append(tt)
        data["tags"] = tags

        return ValidateResult(ok=True, issues=[], data=data)