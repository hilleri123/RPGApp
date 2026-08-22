# locations_manager.py
from __future__ import annotations

from typing import Any
from pydantic import ValidationError

from .types import LocationData, ValidateResult, ValidationIssue

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

class LocationsManager:
    kind = "location"

    def config(self, context: dict[str, Any] | None = None) -> dict[str, Any]:
        return {
            "constraints": {
                "temperatureMin": -100,
                "temperatureMax": 200,
                "illuminationMin": 0,
                "illuminationMax": 100,
            },
            "initialData": {
                "temperatureC": 0,
                "illumination": 50,
            },
        }

    def validate_and_enrich(self, payload: dict[str, Any], context: dict[str, Any] | None = None) -> ValidateResult:
        issues: list[ValidationIssue] = []
        try:
            loc = LocationData.model_validate(payload) if hasattr(LocationData, "model_validate") else LocationData.parse_obj(payload)
        except ValidationError as e:
            for err in e.errors():
                loc_path = ".".join(str(x) for x in err.get("loc", []))
                issues.append(ValidationIssue(path=f"data.{loc_path}" if loc_path else "data", message=err.get("msg", "Invalid"), icon="error"))
            return ValidateResult(ok=False, issues=issues, data=None)

        data = loc.model_dump() if hasattr(loc, "model_dump") else loc.dict()
        data["tags"] = _norm_unique_str_list(data.get("tags"))

        return ValidateResult(ok=True, issues=issues, data=data)
