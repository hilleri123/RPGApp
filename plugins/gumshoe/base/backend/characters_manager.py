# characters.py
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

        # Дефолты. Мастер/сценарий может переопределить, а потом записать в data.points.
        default_investigative_max = 0
        default_general_max = 60  # типичный дефолт SRD, но оставим как стартовое значение. [page:0]

        return {
            **base,
            "constraints": {
                # Оставим для фронта, если ему удобно, но валидируем по data.points
                "defaultInvestigativePoints": default_investigative_max,
                "defaultGeneralPoints": default_general_max,
            },
            "initialData": {
                "name": "",
                "skills": {s["id"]: 0 for s in base["skills"]},
                "items": [],
                "points": {
                    "investigativeMax": default_investigative_max,
                    "generalMax": default_general_max,
                },
            },
        }

    def validate_and_enrich(self, payload: dict[str, Any], context: dict[str, Any] | None = None) -> ValidateResult:
        issues: list[ValidationIssue] = []

        try:
            ch = (
                CharacterData.model_validate(payload)
                if hasattr(CharacterData, "model_validate")
                else CharacterData.parse_obj(payload)
            )
        except ValidationError as e:
            for err in e.errors():
                loc = ".".join(str(x) for x in err.get("loc", []))
                issues.append(
                    ValidationIssue(
                        path=f"data.{loc}" if loc else "data",
                        message=err.get("msg", "Invalid"),
                        icon="error",
                    )
                )
            return ValidateResult(ok=False, issues=issues, data=None)

        allowed = self.skills.allowed_map()

        inv_total = 0
        gen_total = 0

        # unknown skills + подсчёт по категориям
        for sid, val in ch.skills.items():
            if sid not in allowed:
                issues.append(
                    ValidationIssue(
                        path=f"data.skills.{sid}",
                        message="Unknown skill",
                        icon="error",
                    )
                )
                continue

            kind = self.skills.skill_kind(sid)
            if kind == "investigative":
                inv_total += val
            elif kind == "general":
                gen_total += val
            else:
                issues.append(
                    ValidationIssue(
                        path=f"data.skills.{sid}",
                        message="Skill has unknown kind/group mapping",
                        icon="error",
                    )
                )

        # бюджеты задаются мастером в data.points
        inv_max = ch.points.investigativeMax
        gen_max = ch.points.generalMax

        if inv_total > inv_max:
            issues.append(
                ValidationIssue(
                    path="data.skills",
                    message=f"Too many investigative points: {inv_total}/{inv_max}",
                    icon="error",
                )
            )

        if gen_total > gen_max:
            issues.append(
                ValidationIssue(
                    path="data.skills",
                    message=f"Too many general points: {gen_total}/{gen_max}",
                    icon="error",
                )
            )

        if issues:
            return ValidateResult(ok=False, issues=issues, data=None)

        # enrich
        data = ch.model_dump() if hasattr(ch, "model_dump") else ch.dict()
        data["skill_points"] = {
            "investigativeTotal": inv_total,
            "generalTotal": gen_total,
        }
        return ValidateResult(ok=True, issues=[], data=data)
