from __future__ import annotations

from typing import Any
from pydantic import ValidationError

from .types import CharacterData, CharacterPoints
from plugins.common.types import ValidateResult, ValidationIssue, PluginPayload
from .codex import FullCodex


class CharactersManager:
    kind = "character"

    def __init__(self, codex: FullCodex) -> None:
        self.skills = codex.skills

    def config(self, context: dict[str, Any] | None = None) -> dict[str, Any]:
        base = self.skills.as_config()
        return {
            **base,
            "initialData": self.init(context),
        }

    def init(self, context: dict[str, Any] = None) -> dict[str, Any]:
        default_investigative_max = 15
        default_general_max = 30

        return CharacterData(
            skills={},
            initial_skills={},
            items=[],
            points=CharacterPoints(
                investigativeMax=default_investigative_max,
                generalMax=default_general_max,
            ),
        ).model_dump(mode="json")

    def _validate_skill_map(
        self,
        skills_map: dict[str, int],
        allowed: dict[str, Any],
        issues: list[ValidationIssue],
        prefix: str,
    ) -> tuple[int, int]:
        inv_total = 0
        gen_total = 0

        for sid, val in skills_map.items():
            if sid not in allowed:
                issues.append(
                    ValidationIssue(
                        path=f"{prefix}.{sid}",
                        message="Unknown skill",
                        icon="error",
                    )
                )
                continue

            kind = self.skills.skill_kind(sid)
            if kind == "investigative":
                inv_total += val
            elif kind == "general" or kind == "both":
                gen_total += val
            else:
                issues.append(
                    ValidationIssue(
                        path=f"{prefix}.{sid}",
                        message="Skill has unknown kind/group mapping",
                        icon="error",
                    )
                )

        return inv_total, gen_total

    def validate_and_enrich(
        self,
        payload: PluginPayload,
        context: dict[str, Any] = None,
    ) -> ValidateResult:
        issues: list[ValidationIssue] = []

        result = PluginPayload(
            data=payload["data"],
            tags=payload["tags"],
        )

        try:
            ch = CharacterData.model_validate(payload["data"])
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
            return ValidateResult(ok=False, issues=issues, result=result)

        allowed = self.skills.allowed_map()

        self._validate_skill_map(
            ch.skills,
            allowed,
            issues,
            "data.skills",
        )

        inv_total, gen_total = self._validate_skill_map(
            ch.initial_skills,
            allowed,
            issues,
            "data.initial_skills",
        )

        inv_max = ch.points.investigativeMax
        gen_max = ch.points.generalMax

        if inv_total > inv_max:
            issues.append(
                ValidationIssue(
                    path="data.initial_skills",
                    message=f"Too many investigative points: {inv_total}/{inv_max}",
                    icon="error",
                )
            )

        if gen_total > gen_max:
            issues.append(
                ValidationIssue(
                    path="data.initial_skills",
                    message=f"Too many general points: {gen_total}/{gen_max}",
                    icon="error",
                )
            )

        if issues:
            return ValidateResult(ok=False, issues=issues, result=result)

        data = ch.model_dump(mode="json")
        data["skill_points"] = {
            "investigativeTotal": inv_total,
            "generalTotal": gen_total,
        }

        if "initial_skills" not in data:
            data["initial_skills"] = {}

        result = PluginPayload(
            data=data,
            tags=payload["tags"],
        )
        return ValidateResult(ok=True, issues=[], result=result)

    def dump_html(self, payload: dict, context: dict | None = None) -> str:
        try:
            ch = CharacterData.model_validate(payload.get("data") or payload)
        except Exception:
            return ""

        allowed = self.skills.allowed_map()
        groups: dict[str, list[tuple[str, int]]] = {}

        for sid, val in ch.skills.items():
            if val == 0:
                continue
            skill_obj = allowed.get(sid)
            group = skill_obj.group if skill_obj else "unknown"
            groups.setdefault(group, []).append((sid, val))

        inv_total = sum(
            v for sid, v in ch.skills.items()
            if self.skills.skill_kind(sid) == "investigative"
        )
        gen_total = sum(
            v for sid, v in ch.skills.items()
            if self.skills.skill_kind(sid) in ("general", "both")
        )

        rows = ""
        for group_id, skills in groups.items():
            rows += f'<tr><td colspan="2" style="background:#eef;font-weight:bold;font-size:9pt">{group_id}</td></tr>'
            for sid, val in sorted(skills, key=lambda x: -x[1]):
                label = allowed[sid].title if sid in allowed else sid
                rows += f"<tr><td>{label}</td><td>{val}</td></tr>"

        budget = (
            f"<p style='font-size:9pt;color:#555'>"
            f"Investigative: {inv_total}/{ch.points.investigativeMax} &nbsp;|&nbsp; "
            f"General: {gen_total}/{ch.points.generalMax}"
            f"</p>"
        )

        if not rows:
            return budget + "<p style='color:#aaa;font-style:italic'>Навыки не заданы</p>"

        return (
            budget +
            f"<table style='width:100%;border-collapse:collapse;font-size:10pt'>"
            f"<tr><th>Навык</th><th>Очки</th></tr>"
            f"{rows}"
            f"</table>"
        )