from __future__ import annotations
from typing import Any
from pydantic import ValidationError
from ..types import NpcData
from ..codex import FullCodex
from plugins.common.types import ValidateResult, ValidationIssue
from plugins.common.protocols import PluginPayload


class NpcsManager:
    kind = "npc"

    def __init__(self, full_codex: FullCodex):
        self._codex = full_codex

    def config(self, context: dict[str, Any] | None = None) -> dict[str, Any]:
        npc_cfg = self._codex.npcs.config()   # возвращает group_tags, nature_tags, …
        return {
            "initialData": {
                "hp": 6, "hp_current": 6, "armor": 0,
                "instinct": "",
                "group_tags": [], "nature_tags": [],
                "special_qualities": [],
                "attacks": [], "moves": [],
            },
            **npc_cfg,                         # разворачиваем прямо в корень
            "pbta": {**self._codex.as_config()},
            "nameGenerators": self._codex.name_generators.as_config(),
        }

    def validate_and_enrich(
        self,
        payload: PluginPayload,
        context: dict[str, Any] | None = None,
    ) -> ValidateResult:
        issues: list[ValidationIssue] = []

        try:
            npc = NpcData.model_validate(payload["data"])
        except ValidationError as e:
            for err in e.errors():
                loc = ".".join(str(x) for x in err.get("loc", []))
                issues.append(ValidationIssue(
                    path=f"data.{loc}" if loc else "data",
                    message=err.get("msg", "Invalid"),
                    icon="error",
                ))
            return ValidateResult(ok=False, issues=issues, result=None)

        if npc.hp < 1:
            issues.append(ValidationIssue(path="data.hp", message="HP минимум 1", icon="error"))

        if len(npc.instinct.strip()) == 0:
            issues.append(ValidationIssue(
                path="data.instinct",
                message="Instinct обязателен — это главная мотивация NPC",
                icon="warning",
            ))

        for i, atk in enumerate(npc.attacks):
            if not atk.damage.strip():
                issues.append(ValidationIssue(
                    path=f"data.attacks.{i}.damage",
                    message="Укажи кубик урона атаки",
                    icon="error",
                ))
            if not atk.range_tags:
                issues.append(ValidationIssue(
                    path=f"data.attacks.{i}.range_tags",
                    message="Укажи дальность атаки",
                    icon="error",
                ))

        if issues:
            return ValidateResult(ok=False, issues=issues, result=None)

        data = npc.model_dump(mode="json")
        data["hp_current"] = min(data["hp_current"], data["hp"])

        result = PluginPayload(
            data=data,
            tags=payload.get("tags", [])
        )
        return ValidateResult(ok=True, issues=[], result=result)
