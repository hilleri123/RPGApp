# obstacles_manager.py
from __future__ import annotations

from typing import Any

from pydantic import ValidationError

from .types import ObstacleData, ValidateResult, ValidationIssue
from .codex_skills import SkillsCodex


class ObstaclesManager:
    kind = "obstacle"

    def __init__(self, skills: SkillsCodex) -> None:
        self.skills = skills

    def config(self, context: dict[str, Any] | None = None) -> dict[str, Any]:
        print("!!!!!!")
        base = self.skills.as_config()
        return {
            **base,
            "initialData": {
                "type": "clue",
                "name": "",
                "description": "",
                "investigative_skills": [],
                "spend_cost": 0,
                "reward": "",
            },
        }

    def validate_and_enrich(self, payload: dict[str, Any], context: dict[str, Any] | None = None) -> ValidateResult:
        issues: list[ValidationIssue] = []

        try:
            ob = ObstacleData.model_validate(payload) if hasattr(ObstacleData, "model_validate") else ObstacleData.parse_obj(payload)  # type: ignore[attr-defined]
        except ValidationError as e:
            for err in e.errors():
                loc = ".".join(str(x) for x in err.get("loc", []))
                issues.append(ValidationIssue(path=f"data.{loc}" if loc else "data", message=err.get("msg", "Invalid"), icon="error"))
            return ValidateResult(ok=False, issues=issues, data=None)

        allowed = self.skills.allowed_map()

        if ob.type == "clue":
            # investigative_skills может быть пустым, если “всем/любой подходящей” — решай сам.
            for sid in ob.investigative_skills:
                if sid not in allowed:
                    issues.append(ValidationIssue(path=f"data.investigative_skills", message=f"Unknown skill: {sid}", icon="error"))
                    continue
                if self.skills.skill_kind(sid) != "investigative":
                    issues.append(ValidationIssue(path=f"data.investigative_skills", message=f"Not an investigative skill: {sid}", icon="error"))

        elif ob.type == "challenge":
            sid = ob.general_skill
            if not sid:
                issues.append(ValidationIssue(path="data.general_skill", message="general_skill is required", icon="error"))
            elif sid not in allowed:
                issues.append(ValidationIssue(path="data.general_skill", message="Unknown skill", icon="error"))
            elif self.skills.skill_kind(sid) != "general":
                issues.append(ValidationIssue(path="data.general_skill", message="general_skill must be a general ability", icon="error"))

            if ob.difficulty < 2:
                issues.append(ValidationIssue(path="data.difficulty", message="difficulty must be >= 2", icon="error"))

        else:
            issues.append(ValidationIssue(path="data.type", message="Unknown obstacle type", icon="error"))

        if issues:
            return ValidateResult(ok=False, issues=issues, data=None)

        data = ob.model_dump() if hasattr(ob, "model_dump") else ob.dict()
        return ValidateResult(ok=True, issues=[], data=data)
