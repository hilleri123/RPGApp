# npcs_manager.py
from __future__ import annotations

from typing import Any
from pydantic import ValidationError

from .types import NpcData, ValidateResult, ValidationIssue

def _norm_unique_str_list(xs: Any) -> list[str]:
    if not isinstance(xs, list):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for x in xs:
        s = (str(x) if x is not None else "").strip()
        if s and s not in seen:
            seen.add(s)
            out.append(s)
    return out

class NpcsManager:
    kind = "npc"

    def config(self, context: dict[str, Any] | None = None) -> dict[str, Any]:
        # NPC тоже может пользоваться тэгами из общего каталога (когда ты его добавишь)
        tags_catalog: list[dict[str, Any]] = []

        return {
            "tagsCatalog": tags_catalog,
            "constraints": {
                "economyDefaults": {"main": 1, "move": 1, "defense": 1},
            },
            "initialData": {
                "id": "",
                "name": "NPC",
                "kind": "npc",
                "description": "",
                "tags": [],
                "tracks": {"hp": 3, "eq": 2},
                "trackMax": {"hp": 3, "eq": 2},
                "economy": {"main": 1, "move": 1, "defense": 1},
                "items": [],
                "meta": {},
            },
        }

    def validate_and_enrich(self, payload: dict[str, Any], context: dict[str, Any] | None = None) -> ValidateResult:
        issues: list[ValidationIssue] = []
        ctx = context or {}
        cfg = self.config(ctx)

        try:
            npc = NpcData.model_validate(payload) if hasattr(NpcData, "model_validate") else NpcData.parse_obj(payload)
        except ValidationError as e:
            for err in e.errors():
                loc = ".".join(str(x) for x in err.get("loc", []))
                issues.append(ValidationIssue(path=f"data.{loc}" if loc else "data", message=err.get("msg", "Invalid"), icon="error"))
            return ValidateResult(ok=False, issues=issues, data=None)

        data = npc.model_dump() if hasattr(npc, "model_dump") else npc.dict()

        # normalize tags/items
        data["tags"] = _norm_unique_str_list(data.get("tags"))
        data["items"] = _norm_unique_str_list(data.get("items"))

        # validate tags against catalog (если он задан)
        allowed_tag_ids = {t.get("id") for t in (cfg.get("tagsCatalog") or []) if isinstance(t, dict) and isinstance(t.get("id"), str)}
        if allowed_tag_ids:
            for t in data["tags"]:
                if t not in allowed_tag_ids:
                    issues.append(ValidationIssue(path="data.tags", message=f"Unknown tag '{t}'", icon="error"))

        # economy minimal checks
        econ = data.get("economy") or {}
        for k in ("main", "move", "defense"):
            v = econ.get(k, None)
            if not isinstance(v, int) or v < 0 or v > 3:
                issues.append(ValidationIssue(path=f"data.economy.{k}", message="Economy slot must be int in range 0..3", icon="error"))
        data["economy"] = {"main": int(econ.get("main", 1) or 0), "move": int(econ.get("move", 1) or 0), "defense": int(econ.get("defense", 1) or 0)}

        if any(i.level == "error" for i in issues):
            return ValidateResult(ok=False, issues=issues, data=None)

        data.setdefault("derived", {})
        return ValidateResult(ok=True, issues=issues, data=data)
