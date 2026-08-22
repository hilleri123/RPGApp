# scenes_manager.py
from __future__ import annotations

from typing import Any, Literal, Optional
from pydantic import BaseModel, Field, NonNegativeInt, ValidationError, model_validator

from .types import SceneData
from plugins.common.types import ValidateResult, ValidationIssue



def _pydantic_validate(model_cls: Any, payload: Any) -> Any:
    if hasattr(model_cls, "model_validate"):
        return model_cls.model_validate(payload)
    return model_cls.parse_obj(payload)


def _pydantic_dump(model: Any) -> dict[str, Any]:
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


class ScenesManager:
    kind = "scene"

    def config(self, context: dict[str, Any] | None = None) -> dict[str, Any]:
        return {
            "sceneModes": ["travel", "rest"],
            "initialData": self.init(context),
        }

    def init(self, context: dict[str, Any] | None = None) -> dict[str, Any]:
        # минимальная валидная сцена
        return _pydantic_dump(SceneData(mode="travel"))

    def validate_and_enrich(self, payload: dict[str, Any], context: dict[str, Any] | None = None) -> ValidateResult:
        issues: list[ValidationIssue] = []
        try:
            scene = _pydantic_validate(SceneData, payload or {})
        except ValidationError as e:
            for err in e.errors():
                loc = ".".join(str(x) for x in err.get("loc", []) if x is not None)
                issues.append(
                    ValidationIssue(
                        path=f"data.{loc}" if loc else "data",
                        message=err.get("msg", "Invalid"),
                        icon="error",
                    )
                )
            return ValidateResult(ok=False, issues=issues, data=None)

        data = _pydantic_dump(scene)

        if any(getattr(i, "level", "error") == "error" for i in issues):
            return ValidateResult(ok=False, issues=issues, data=None)

        return ValidateResult(ok=True, issues=issues, data=data)
