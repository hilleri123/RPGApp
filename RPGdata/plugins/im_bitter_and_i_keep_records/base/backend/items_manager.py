from __future__ import annotations

from typing import Any

from pydantic import ValidationError

from .types import ItemData, ValidateResult, ValidationIssue
from .codex import tags

def _norm_unique_str_list(xs: Any) -> list[str]:
    if not isinstance(xs, list):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for x in xs:
        s = (str(x) if x is not None else "").strip()
        if s and s not in seen:
            seen.add(s)
            out.append(s)
    return out


def _pydantic_validate(model_or_type: Any, payload: Any) -> Any:
    """
    Работает для:
    - BaseModel классов (v1/v2)
    - typing типов (Annotated/Union) через TypeAdapter (v2) или parse_obj_as (v1)
    """
    # Pydantic v2: BaseModel class has model_validate, typing types validate via TypeAdapter
    if hasattr(model_or_type, "model_validate"):
        return model_or_type.model_validate(payload)

    try:
        from pydantic import TypeAdapter  # v2
        return TypeAdapter(model_or_type).validate_python(payload)
    except Exception:
        # Pydantic v1 fallback
        from pydantic import parse_obj_as  # type: ignore
        return parse_obj_as(model_or_type, payload)


def _pydantic_dump(model: Any) -> dict[str, Any]:
    if isinstance(model, dict):
        return model
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()



class ItemsManager:
    kind = "item"

    def config(self, context: dict[str, Any] | None = None) -> dict[str, Any]:
        tags_catalog = tags.all()  # <-- ВОТ ЭТО ДОБАВЛЯЕМ

        return {
            "itemTypes": ["weapon", "armor", "shield", "tool", "consumable", "rune", "scroll", "clothing", "misc"],
            "damageTypes": ["piercing", "slashing", "blunt", "fire", "cold", "electric"],
            "magicSources": ["none", "rune", "scroll"],

            # новый блок для фронта
            "tagsCatalog": tags_catalog,
            "tagCategories": ["technique", "material", "tactic"],

            "constraints": {
                "magicOnlyFrom": ["rune", "scroll"],
                "damageOnlyFrom": ["weapon", "shield", "rune", "scroll"],
                "defenseOnlyFrom": ["weapon", "shield", "armor", "clothing"],
                "noMasteryOn": ["consumable"],
            },
            "initialData": {
                "type": "misc",
                "requiredTags": [],
                "keyTags": [],
                "tags": [],
                "masteryRules": {"noviceAt": 1, "trainedAt": 2, "masterAt": 3, "legendAt": 4},
            },
        }

    def validate_and_enrich(self, payload: dict[str, Any], context: dict[str, Any] | None = None) -> ValidateResult:
        issues: list[ValidationIssue] = []

        # 1) Pydantic validation (строгие правила по type должны отработать тут) [web:130]
        try:
            it = _pydantic_validate(ItemData, payload)
        except ValidationError as e:
            for err in e.errors():  # loc/msg [web:12][web:15]
                loc = ".".join(str(x) for x in err.get("loc", []) if x is not None)
                issues.append(
                    ValidationIssue(
                        path=f"data.{loc}" if loc else "data",
                        message=err.get("msg", "Invalid"),
                        icon="error",
                    )
                )
            return ValidateResult(ok=False, issues=issues, data=None)

        data = _pydantic_dump(it)

        # 2) Normalize list fields (в union-моделях эти поля есть у всех BaseItem-наследников)
        data["tags"] = _norm_unique_str_list(data.get("tags"))
        data["requiredTags"] = _norm_unique_str_list(data.get("requiredTags"))
        data["keyTags"] = _norm_unique_str_list(data.get("keyTags"))

        # 3) keyTags must be subset of requiredTags
        req = set(data["requiredTags"])
        extra_keys = [kt for kt in data["keyTags"] if kt not in req]
        if extra_keys:
            for kt in extra_keys:
                issues.append(
                    ValidationIssue(
                        path="data.keyTags",
                        message=f"keyTag '{kt}' must be present in requiredTags",
                        icon="error",
                    )
                )

        # 4) Optional extra consistency checks (по желанию — можешь ужесточить/смягчить)
        itype = str(data.get("type") or "").strip()

        # damage presence sanity (если поле damage вообще есть в этом типе)
        if "damage" in data:
            if itype not in ("weapon", "shield", "rune", "scroll"):
                issues.append(ValidationIssue(path="data.damage", message=f"damage is not allowed for type '{itype}'", icon="error"))
            # если хочешь требовать non-empty:
            # if isinstance(data.get("damage"), list) and not data["damage"]:
            #     issues.append(ValidationIssue(path="data.damage", message="damage must be non-empty for this item type", icon="warning"))

        # defense presence sanity
        if "defense" in data:
            if itype not in ("weapon", "shield", "armor", "clothing"):
                issues.append(ValidationIssue(path="data.defense", message=f"defense is not allowed for type '{itype}'", icon="error"))

        # magic sanity (поле magic существует только у rune/scroll; если extra='forbid' — лишнее не пройдёт и сюда не попадёт)
        if "magic" in data:
            magic = str(data.get("magic") or "").strip()
            if itype not in ("rune", "scroll"):
                issues.append(ValidationIssue(path="data.magic", message="Magic is only allowed for type 'rune' or 'scroll'", icon="error"))
            if magic == "rune" and itype != "rune":
                issues.append(ValidationIssue(path="data.magic", message="magic='rune' requires item.type='rune'", icon="error"))
            if magic == "scroll" and itype != "scroll":
                issues.append(ValidationIssue(path="data.magic", message="magic='scroll' requires item.type='scroll'", icon="error"))

        # masteryRules must be absent on consumable (если у consumable модели его нет и extra='forbid' — pydantic поймает раньше)
        if itype == "consumable" and "masteryRules" in data:
            issues.append(ValidationIssue(path="data.masteryRules", message="Consumables must not have masteryRules", icon="error"))

        if any(getattr(i, "level", "error") == "error" for i in issues):
            return ValidateResult(ok=False, issues=issues, data=None)

        return ValidateResult(ok=True, issues=issues, data=data)
