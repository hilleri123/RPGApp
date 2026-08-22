from __future__ import annotations

from typing import Any, Literal, Optional, TypedDict, Protocol, runtime_checkable

from pydantic import BaseModel, Field


PluginKind = Literal["config", "schema", "options", "validate", "actions", "action_config", "action_apply", "init"]
EntityType = Literal["character", "npc", "item", "location", "scene"]


class Issue(TypedDict, total=False):
    path: str
    message: str
    icon: str
    level: str  # "error" | "warning"


class PluginResponse(TypedDict, total=False):
    ok: bool
    issues: list[Issue]
    data: Any
    config: Any
    actions: Any



class EntityPayload(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)



class ValidationResult(BaseModel):
    ok: bool
    issues: list[dict[str, Any]] = Field(default_factory=list)
    result: Optional[EntityPayload]
    


@runtime_checkable
class RulesFactoryProto(Protocol):
    system_id: str

    def handle(
        self,
        kind: PluginKind,
        entity: EntityType | None,
        payload: Any,
        context: Any,
    ) -> PluginResponse: ...


@runtime_checkable
class RulesPluginProto(Protocol):
    plugin_id: str
    plugin_name: str
    plugin_version: str
    parent_id: str | None

    def get_factory(self) -> RulesFactoryProto: ...
