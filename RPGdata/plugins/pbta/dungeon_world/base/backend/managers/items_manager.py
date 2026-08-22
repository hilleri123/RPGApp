from __future__ import annotations
from typing import Any
from pydantic import ValidationError

from plugins.common.types import ValidateResult, ValidationIssue
from plugins.common.protocols import PluginPayload
from ..types.items import ItemData
from ..codex import FullCodex


class ItemsManager:
    kind = "item"

    def __init__(self, full_codex: FullCodex):
        self._codex = full_codex

    def config(self, context: dict[str, Any] | None = None) -> dict[str, Any]:
        return {
            "initialData": {
                "general_tags": [],
                "weight":       1,
                "cost":         None,
                "weapon":       None,
                "armor":        None,
            },
            "tags":  self._codex.items.config_dict(),    # только meta, без механики
            "pbta":  {**self._codex.as_config()},
            "nameGenerators": self._codex.name_generators.as_config(),
        }

    def validate_and_enrich(
        self,
        payload: PluginPayload,
        context: dict[str, Any] | None = None,
    ) -> ValidateResult:
        issues: list[ValidationIssue] = []

        try:
            item = ItemData.model_validate(payload["data"])
        except ValidationError as e:
            for err in e.errors():
                loc = ".".join(str(x) for x in err.get("loc", []))
                issues.append(ValidationIssue(
                    path=f"data.{loc}" if loc else "data",
                    message=err.get("msg", "Invalid"),
                    icon="error",
                ))
            return ValidateResult(ok=False, issues=issues, result=None)

        issues += self._validate_item(item)
        if issues:
            return ValidateResult(ok=False, issues=issues, result=None)

        # нормализуем general_tags
        seen: set[str] = set()
        item.general_tags = [
            t for t in (t.strip() for t in item.general_tags)
            if t and not (t in seen or seen.add(t))
        ]

        data = item.model_dump(mode="json")
        data["derived"] = self._derive(item)

        result = PluginPayload(data=data, tags=payload.get("tags", []))
        return ValidateResult(ok=True, issues=[], result=result)

    # ── validation ────────────────────────────────────────────────────────────

    def _validate_item(self, item: ItemData) -> list[ValidationIssue]:
        issues: list[ValidationIssue] = []
        mech = self._codex.items.mechanics_map()

        if item.weapon is not None:
            if not item.weapon.range_tags:
                issues.append(ValidationIssue(
                    path="data.weapon.range_tags",
                    message="Укажи хотя бы один тег дальности",
                    icon="error",
                ))
            # two-handed + shield несовместимы
            has_two_handed = any(
                mech.get(t) and mech[t].no_shield
                for t in item.weapon.mechanic_tags
            )
            if has_two_handed and item.armor is not None:
                shield_in_armor = "shield" in (item.armor.mechanic_tags or [])
                if shield_in_armor:
                    issues.append(ValidationIssue(
                        path="data.weapon.mechanic_tags",
                        message="Two-handed несовместим с щитом",
                        icon="warning",
                    ))

        if item.armor is not None:
            if item.armor.armor is None:
                issues.append(ValidationIssue(
                    path="data.armor.armor",
                    message="Укажи значение брони",
                    icon="error",
                ))
            if "clumsy" in (item.armor.mechanic_tags or []) and "worn" not in (item.armor.mechanic_tags or []):
                issues.append(ValidationIssue(
                    path="data.armor.mechanic_tags",
                    message="Clumsy обычно сопровождает Worn",
                    icon="warning",
                ))

        return issues

    # ── enrich ────────────────────────────────────────────────────────────────

    def _derive(self, item: ItemData) -> dict[str, Any]:
        """
        Вычисляет механические эффекты из тегов.
        Эти данные используются при разрешении ходов (Hack&Slash, Volley и т.д.)
        и никогда не хранятся в ItemData напрямую.
        """
        mech = self._codex.items.mechanics_map()
        derived: dict[str, Any] = {}

        if item.weapon:
            wp = item.weapon
            weapon_derived: dict[str, Any] = {
                "damage_dice":    wp.damage_dice,   # None = куб класса
                "damage_bonus":   wp.damage_bonus.bonus if wp.damage_bonus else 0,
                "piercing":       wp.piercing.value if wp.piercing else 0,
                "use_dex":        any(mech.get(t) and mech[t].use_dex_for_melee for t in wp.mechanic_tags),
                "forceful":       any(mech.get(t) and mech[t].forceful          for t in wp.mechanic_tags),
                "ignores_armor":  any(mech.get(t) and mech[t].ignores_armor     for t in wp.mechanic_tags),
                "requires_reload": any(mech.get(t) and mech[t].requires_reload  for t in wp.mechanic_tags),
                "range":          list(wp.range_tags),
            }
            derived["weapon"] = weapon_derived

        if item.armor:
            ar = item.armor
            base_armor = ar.armor.value if ar.armor else 0
            stacks     = ar.armor.stacks if ar.armor else False
            # ongoing penalty суммируем по всем тегам (например два clumsy предмета)
            ongoing    = sum(
                mech[t].ongoing_penalty
                for t in ar.mechanic_tags
                if mech.get(t)
            )
            armor_derived: dict[str, Any] = {
                "armor_value":     base_armor,
                "stacks":          stacks,
                "ongoing_penalty": ongoing,
                "is_shield":       "shield" in ar.mechanic_tags,
            }
            derived["armor"] = armor_derived

        derived["weight"] = item.weight
        return derived