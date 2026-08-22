from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class EditorInitContext(BaseModel):
    scenario_id: Optional[UUID] = None
    template_set_id: Optional[UUID] = None
    scene_id: Optional[str] = None
    extra: dict[str, Any] = Field(default_factory=dict)

    @classmethod
    def from_raw(cls, raw: dict[str, Any] | None) -> EditorInitContext:
        if not raw:
            return cls()
        data = dict(raw)
        extra = dict(data.pop("extra", {}) or {})
        for key in list(data.keys()):
            if key not in cls.model_fields:
                extra[key] = data.pop(key)
        return cls(**data, extra=extra)

    def to_manager_context(self) -> dict[str, Any]:
        out = self.model_dump(mode="json", exclude_none=True)
        extra = out.pop("extra", {}) or {}
        out.update(extra)
        return out


class EditorOptionsContext(BaseModel):
    scenario_id: Optional[UUID] = None
    template_set_id: Optional[UUID] = None
    scene_id: Optional[str] = None
    playbook_id: Optional[str] = None
    level: Optional[int] = None
    data: dict[str, Any] = Field(default_factory=dict)
    extra: dict[str, Any] = Field(default_factory=dict)

    @classmethod
    def from_raw(cls, raw: dict[str, Any] | None) -> EditorOptionsContext:
        if not raw:
            return cls()
        data = dict(raw)
        extra = dict(data.pop("extra", {}) or {})
        entity_data = dict(data.pop("data", {}) or {})
        for key in list(data.keys()):
            if key not in cls.model_fields:
                extra[key] = data.pop(key)
        ctx = cls(**data, extra=extra)
        if entity_data:
            ctx.data = entity_data
        if not ctx.playbook_id:
            ctx.playbook_id = entity_data.get("playbook_id")
        if ctx.level is None and entity_data.get("level") is not None:
            ctx.level = int(entity_data["level"])
        return ctx

    def to_manager_context(self) -> dict[str, Any]:
        out = self.model_dump(mode="json", exclude_none=True)
        extra = out.pop("extra", {}) or {}
        out.update(extra)
        return out
