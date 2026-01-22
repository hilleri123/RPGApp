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

        general_ids = [s.id for s in self.skills.skills_by_kind("general")]
        return {
            **base,
            "initialData": {
                "name": "",
                "description": "",
                "skills": {sid: 0 for sid in general_ids},
                "items": [],
                "health": None,
                "stability": None,
                "armor": None,
                "hitThreshold": None,
            },
        }

    def validate_and_enrich(self, payload: dict[str, Any], context: dict[str, Any] | None = None) -> ValidateResult:
        issues: list[ValidationIssue] = []

        try:
            npc = NpcData.model_validate(payload) if hasattr(NpcData, "model_validate") else NpcData.parse_obj(payload)
        except ValidationError as e:
            for err in e.errors():
                loc = ".".join(str(x) for x in err.get("loc", []))
                issues.append(ValidationIssue(path=f"data.{loc}" if loc else "data", message=err.get("msg", "Invalid"), icon="error"))
            return ValidateResult(ok=False, issues=issues, data=None)

        allowed = self.skills.allowed_map()

        for sid, val in (npc.skills or {}).items():
            if sid not in allowed:
                issues.append(ValidationIssue(path=f"data.skills.{sid}", message="Unknown skill", icon="error"))
                continue
            kind = self.skills.skill_kind(sid)
            if kind != "general":
                issues.append(ValidationIssue(path=f"data.skills.{sid}", message="NPC skills must be general abilities only", icon="error"))
                continue

        if issues:
            return ValidateResult(ok=False, issues=issues, data=None)

        data = npc.model_dump() if hasattr(npc, "model_dump") else npc.dict()
        return ValidateResult(ok=True, issues=[], data=data)
