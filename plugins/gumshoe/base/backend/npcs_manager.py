from __future__ import annotations
from typing import Any
from pydantic import ValidationError

from .types import NpcData, ValidateResult, ValidationIssue
from .codex_skills import SkillsCodex

class NpcsManager:
    kind = "npc"

    def __init__(self, skills: SkillsCodex) -> None:
        self.skills = skills

    def config(self, context: dict[str, Any] | None = None) -> dict[str, Any]:
        base = self.skills.as_config()
        return {
            **base,
            "constraints": {"maxSkillPoints": 6},
            "initialData": {"name": "", "role": "npc", "skills": {s["id"]: 0 for s in base["skills"]}, "items": []},
        }

    def validate_and_enrich(self, payload: dict[str, Any], context: dict[str, Any] | None = None) -> ValidateResult:
        try:
            npc = NpcData.model_validate(payload) if hasattr(NpcData, "model_validate") else NpcData.parse_obj(payload)
        except ValidationError as e:
            issues = [
                ValidationIssue(path="data." + ".".join(str(x) for x in err.get("loc", [])),
                                message=err.get("msg", "Invalid"),
                                icon="error")
                for err in e.errors()
            ]
            return ValidateResult(ok=False, issues=issues, data=None)

        # простой enrich пример
        data = npc.model_dump() if hasattr(npc, "model_dump") else npc.dict()
        data["role"] = (data.get("role") or "npc").lower()
        return ValidateResult(ok=True, issues=[], data=data)
