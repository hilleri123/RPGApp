from __future__ import annotations
from typing import Any
from pydantic import ValidationError

from .types import NpcData
from plugins.common.types import ValidateResult, ValidationIssue, PluginPayload
from .codex import FullCodex

class NpcsManager:
    kind = "npc"

    def __init__(self, codex: FullCodex) -> None:
        self.skills = codex.skills

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

    def validate_and_enrich(self, payload: PluginPayload, context: dict[str, Any] | None = None) -> ValidateResult:
        issues: list[ValidationIssue] = []

        result = PluginPayload(
            data=payload["data"],
            tags=payload["tags"]
        )
        try:
            npc = NpcData.model_validate(payload["data"])
        except ValidationError as e:
            for err in e.errors():
                loc = ".".join(str(x) for x in err.get("loc", []))
                issues.append(ValidationIssue(path=f"data.{loc}" if loc else "data", message=err.get("msg", "Invalid"), icon="error"))
            return ValidateResult(ok=False, issues=issues, result=result)

        allowed = self.skills.allowed_map()

        for sid, val in (npc.skills or {}).items():
            if sid not in allowed:
                issues.append(ValidationIssue(path=f"data.skills.{sid}", message="Unknown skill", icon="error"))
                continue
            kind = self.skills.skill_kind(sid)
            if kind == "investigative":
                issues.append(ValidationIssue(path=f"data.skills.{sid}", message="NPC skills must be general abilities only", icon="error"))
                continue

        if issues:
            return ValidateResult(ok=False, issues=issues, result=result)

        data = npc.model_dump() if hasattr(npc, "model_dump") else npc.dict()
        result = PluginPayload(
            data=data,
            tags=payload["tags"] or []
        )
        return ValidateResult(ok=True, issues=[], result=result)


    def dump_html(self, payload: dict, context: dict | None = None) -> str:
        try:
            npc = NpcData.model_validate(payload.get("data") or payload)
        except Exception:
            return ""

        parts = []

        # навыки
        if npc.skills:
            allowed = self.skills.allowed_map()
            rows = ""
            for sid, val in sorted(npc.skills.items(), key=lambda x: -x[1]):
                if val == 0:
                    continue
                label = allowed[sid].title if sid in allowed else sid
                rows += f"<tr><td>{label}</td><td>{val}</td></tr>"
            if rows:
                parts.append(
                    f"<table style='width:100%;border-collapse:collapse;font-size:10pt'>"
                    f"<tr><th>Навык</th><th>Очки</th></tr>{rows}</table>"
                )

        # боевые параметры
        combat = []
        if npc.armor is not None:
            combat.append(f"Броня: {npc.armor}")
        if npc.hitThreshold is not None:
            combat.append(f"Порог попадания: {npc.hitThreshold}")
        if combat:
            parts.append(
                "<p style='font-size:9pt'>" + " &nbsp;|&nbsp; ".join(combat) + "</p>"
            )

        # атаки
        if npc.attacks:
            rows = "".join(
                f"<tr><td>{a.name}</td><td>{a.attack_skill}</td><td>{a.attack_dmg}</td></tr>"
                for a in npc.attacks
            )
            parts.append(
                f"<table style='width:100%;border-collapse:collapse;font-size:10pt'>"
                f"<tr><th>Атака</th><th>Навык</th><th>Урон</th></tr>{rows}</table>"
            )

        # предметы
        if npc.items:
            items_html = ", ".join(
                (i.tags[0] if i.tags else "item") for i in npc.items
            )
            parts.append(f"<p style='font-size:9pt'><strong>Предметы:</strong> {items_html}</p>")

        return "".join(parts)
