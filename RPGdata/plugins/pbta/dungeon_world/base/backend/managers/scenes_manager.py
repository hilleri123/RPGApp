# scenes_manager.py
from __future__ import annotations

from typing import Any

from pydantic import ValidationError

from plugins.common.types import ValidateResult, ValidationIssue, PluginPayload
from ..types import SceneData
from ..codex import FullCodex



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

    def __init__(self, full_codex: FullCodex):
        self._codex = full_codex

    def config(self, context: dict[str, Any] = None) -> dict[str, Any]:
        return {
            "initialData": self.init(context),
            "constraints": {},
            "sceneModes": ["travel", "camp", "action"],
            "nameGenerators": self._codex.name_generators.as_config(),
        }

    def init(self, context: dict[str, Any] = None) -> dict[str, Any]:
        return SceneData().model_dump()

    def validate_and_enrich(
        self,
        payload: dict[str, Any] | PluginPayload,
        context: dict[str, Any] | None = None,
    ) -> ValidateResult:
        issues: list[ValidationIssue] = []
        if isinstance(payload, PluginPayload):
            body = payload.model_dump(mode="json")
        else:
            body = payload or {}

        scene_payload = body.get("data") if isinstance(body.get("data"), dict) else body
        tags = body.get("tags") or []

        try:
            scene = _pydantic_validate(SceneData, scene_payload or {})
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
            return ValidateResult(ok=False, issues=issues, result=None)

        data = _pydantic_dump(scene)

        if any(getattr(i, "level", "error") == "error" for i in issues):
            return ValidateResult(ok=False, issues=issues, result=None)

        result = PluginPayload(
            data=data,
            tags=tags,
        )
        return ValidateResult(ok=True, issues=issues, result=result)
