from __future__ import annotations
from typing import Any
from pydantic import ValidationError

from .types import CharacterData, ValidateResult, ValidationIssue
from .codex_skills import SkillsCodex

class CharactersManager:
    kind = "character"

    def __init__(self, skills: SkillsCodex) -> None:
        self.skills = skills

    def config(self, context: dict[str, Any] | None = None) -> dict[str, Any]:
        base = self.skills.as_config()
        return {
            **base,
            "constraints": {"maxSkillPoints": 10},
            "initialData": {
                "name": "",
                "skills": {s["id"]: 0 for s in base["skills"]},
                "items": [],
            },
        }

    def validate_and_enrich(self, payload: dict[str, Any], context: dict[str, Any] | None = None) -> ValidateResult:
        issues: list[ValidationIssue] = []

        try:
            ch = CharacterData.model_validate(payload) if hasattr(CharacterData, "model_validate") else CharacterData.parse_obj(payload)
        except ValidationError as e:
            for err in e.errors():
                loc = ".".join(str(x) for x in err.get("loc", []))
                issues.append(ValidationIssue(path=f"data.{loc}" if loc else "data", message=err.get("msg", "Invalid"), icon="error"))
            return ValidateResult(ok=False, issues=issues, data=None)

        allowed = self.skills.allowed_map()
        max_points = self.config(context).get("constraints", {}).get("maxSkillPoints", 10)

        # unknown skills + bounds
        total = 0
        for sid, val in ch.skills.items():
            if sid not in allowed:
                issues.append(ValidationIssue(path=f"data.skills.{sid}", message="Unknown skill", icon="error"))
                continue
            s = allowed[sid]
            if val < s.min or val > s.max:
                issues.append(ValidationIssue(path=f"data.skills.{sid}", message=f"Value must be {s.min}..{s.max}", icon="error"))
            total += val

        if total > max_points:
            issues.append(ValidationIssue(path="data.skills", message=f"Too many points: {total}/{max_points}", icon="error"))

        if issues:
            return ValidateResult(ok=False, issues=issues, data=None)

        # enrich: skill_points_total
        data = ch.model_dump() if hasattr(ch, "model_dump") else ch.dict()
        data["skill_points_total"] = total
        return ValidateResult(ok=True, issues=[], data=data)
