# obstacles_manager.py
from __future__ import annotations

from typing import Any

from pydantic import ValidationError

from .types import ObstacleData
from plugins.common.types import ValidateResult, ValidationIssue, PluginPayload
from .codex import FullCodex


class ObstaclesManager:
    kind = "obstacle"

    def __init__(self, codex: FullCodex) -> None:
        self.skills = codex.skills

    def config(self, context: dict[str, Any] | None = None) -> dict[str, Any]:
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

    def validate_and_enrich(self, payload: PluginPayload, context: dict[str, Any] | None = None) -> ValidateResult:
        issues: list[ValidationIssue] = []

        result = PluginPayload(
            data=payload["data"],
            tags=payload["tags"]
        )
        try:
            ob = ObstacleData.model_validate(payload["data"])
        except ValidationError as e:
            for err in e.errors():
                loc = ".".join(str(x) for x in err.get("loc", []))
                issues.append(ValidationIssue(path=f"data.{loc}" if loc else "data", message=err.get("msg", "Invalid"), icon="error"))
            return ValidateResult(ok=False, issues=issues, result=result)

        allowed = self.skills.allowed_map()

        for sid in ob.investigative_skills:
            if sid not in allowed:
                issues.append(ValidationIssue(path=f"data.investigative_skills", message=f"Unknown skill: {sid}", icon="error"))
                continue
            if self.skills.skill_kind(sid) != "investigative" or self.skills.skill_kind(sid) != "both":
                issues.append(ValidationIssue(path=f"data.investigative_skills", message=f"Not an investigative skill: {sid}", icon="error"))

        if issues:
            return ValidateResult(ok=False, issues=issues, result=result)

        data = ob.model_dump() if hasattr(ob, "model_dump") else ob.dict()
        result = PluginPayload(
            data=data,
            tags=list(set(payload["tags"]+["hidden"]))
        )
        return ValidateResult(ok=True, issues=[], result=result)
    
    def dump_html(self, payload: dict, context: dict | None = None) -> str:
        try:
            # ожидаем payload = {"data": {...}, "tags": [...]}
            data = payload.get("data") if isinstance(payload, dict) else payload
            obs = ObstacleData.model_validate(data or {})
        except Exception:
            return ""

        parts: list[str] = []

        # базовый текст
        if obs.base_text:
            parts.append(
                "<p style='font-size:10pt; margin:4px 0'>"
                f"{obs.base_text}"
                "</p>"
            )

        # список следов / нужных скиллов
        if obs.investigative_skills:
            skills_html = ", ".join(obs.investigative_skills)
            parts.append(
                "<p style='font-size:9pt; color:#555; margin:4px 0'>"
                f"<strong>Расследовательские навыки:</strong> {skills_html}"
                "</p>"
            )

        # уровни spend’ов
        if obs.spends:
            rows = []
            for sp in obs.spends:
                purchasers = ", ".join(str(pid) for pid in sp.purchased_by) if sp.purchased_by else "—"
                rows.append(
                    "<tr>"
                    f"<td>{sp.name}</td>"
                    f"<td style='text-align:center'>{sp.cost}</td>"
                    f"<td>{sp.info or ''}</td>"
                    f"<td>{purchasers}</td>"
                    "</tr>"
                )
            table = (
                "<table style='width:100%;border-collapse:collapse;font-size:9pt;margin-top:4px'>"
                "<tr>"
                "<th style='border:1px solid #ddd;padding:4px 6px;text-align:left'>Уровень</th>"
                "<th style='border:1px solid #ddd;padding:4px 6px;width:40px;text-align:center'>Стоимость</th>"
                "<th style='border:1px solid #ddd;padding:4px 6px;text-align:left'>Информация</th>"
                "<th style='border:1px solid #ddd;padding:4px 6px;text-align:left'>Купили</th>"
                "</tr>"
                + "".join(rows) +
                "</table>"
            )
            parts.append(table)

        if not parts:
            return "<p style='font-size:9pt;color:#aaa;font-style:italic'>Данные препятствия не заданы</p>"

        return "".join(parts)
