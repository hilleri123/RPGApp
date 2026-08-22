from __future__ import annotations
from typing import Any
from pydantic import ValidationError
from .types import ItemData
from plugins.common.types import ValidateResult, ValidationIssue, PluginPayload


class ItemsManager:
    kind = "item"

    def config(self, context: dict[str, Any] | None = None) -> dict[str, Any]:
        return {
            "tags": ["weapon", "armor", "consumable", "misc"],
            "initialData": self.init(context)
        }
    def init(self, context: dict[str, Any] = None) -> dict[str, Any]:
        return ItemData(
        ).model_dump(mode="json")

    def validate_and_enrich(self, payload: PluginPayload, context: dict[str, Any] | None = None) -> ValidateResult:
        issues: list[ValidationIssue] = []

        result = PluginPayload(
            data=payload["data"],
            tags=payload["tags"]
        )
        try:
            item = ItemData.model_validate(payload["data"])
        except ValidationError as e:
            for err in e.errors():
                loc = ".".join(str(x) for x in err.get("loc", []))
                issues.append(ValidationIssue(path=f"data.{loc}" if loc else "data", message=err.get("msg", "Invalid"), icon="error"))
            return ValidateResult(ok=False, issues=issues, result=result)

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
            return ValidateResult(ok=False, issues=issues, result=result)

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

        result = PluginPayload(
            data=data,
            tags=payload["tags"]
        )
        return ValidateResult(ok=True, issues=[], result=result)
    
    def dump_html(self, payload: dict, context: dict | None = None) -> str:
        try:
            item = ItemData.model_validate(payload.get("data") or payload)
        except Exception:
            return ""

        parts = []

        if item.tags:
            tags_html = " ".join(
                f"<span style='background:#e8e8e8;border-radius:3px;padding:1px 5px;font-size:9pt'>{t}</span>"
                for t in item.tags
            )
            parts.append(f"<div>{tags_html}</div>")

        if item.weapon:
            parts.append(
                f"<p style='font-size:9pt'>"
                f"⚔️ Оружие: {item.weapon.type}, урон: {item.weapon.damage}"
                f"</p>"
            )

        if item.armor:
            vs = ", ".join(item.armor.vs)
            parts.append(
                f"<p style='font-size:9pt'>"
                f"🛡 Броня: {item.armor.rating} (против: {vs})"
                f"</p>"
            )

        return "".join(parts)
