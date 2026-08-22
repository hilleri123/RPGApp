from __future__ import annotations

from typing import Any, Protocol, runtime_checkable

from .workflow import WorkflowRouter
from .editor_dispatch import dispatch_manager_kind
from ..types import ActionContext, EntityKind, SceneContext
from ..workflows import COMMON_WORKFLOWS


@runtime_checkable
class PluginProtocol(Protocol):
    plugin_id: str
    plugin_name: str
    plugin_version: str
    parent_id: str | None

    def get_factory(self): ...
    def describe(self) -> dict[str, Any]: ...


class BaseRulesFactory:
    system_id = "base"

    codex_cls = None

    actions_manager_cls = None
    items_manager_cls = None
    characters_manager_cls = None
    npcs_manager_cls = None
    locations_manager_cls = None
    obstacles_manager_cls = None
    scenes_manager_cls = None

    workflows: list[Any] = []

    def __init__(self) -> None:
        if self.codex_cls is None:
            raise ValueError("codex_cls is required")

        self.codex = self.codex_cls()

        self.actions = self._build_manager("actions_manager_cls")
        self.items = self._build_manager("items_manager_cls")
        self.characters = self._build_manager("characters_manager_cls")
        self.npcs = self._build_manager("npcs_manager_cls")
        self.locations = self._build_manager("locations_manager_cls")
        self.obstacles = self._build_manager("obstacles_manager_cls")
        self.scenes = self._build_manager("scenes_manager_cls")

        self.workflow_router = WorkflowRouter(self.codex)
        for workflow in self.workflows:
            self.workflow_router.register(workflow)
        for workflow in COMMON_WORKFLOWS:
            self.workflow_router.register(workflow)
        self._common_workflow_instances = [WF(self.codex) for WF in COMMON_WORKFLOWS]

    def handle(self, kind: str, entity: EntityKind, payload: Any = None, context: Any = None) -> Any:
        ctx = context if isinstance(context, dict) else {}
        p = payload if isinstance(payload, dict) else {}

        if kind == "actions.list":
            return self._handle_actions_list(p)

        if kind == "workflow.start":
            return self._handle_workflow_start(p)

        if kind == "workflow.submit":
            return self._handle_workflow_submit(p)

        if kind == "workflow.patch":
            return self._handle_workflow_patch(p)

        manager = self._resolve_manager(entity)
        if manager is None:
            return self._error("Unknown route")

        try:
            return dispatch_manager_kind(manager, kind, payload, ctx)
        except ValueError:
            return self._error("Unknown route")

    def _build_manager(self, attr_name: str):
        cls = getattr(self, attr_name, None)
        if cls is None:
            return None
        return cls(self.codex)

    def _handle_actions_list(self, payload: dict[str, Any]) -> Any:
        role = payload.get("role")
        scene = SceneContext.model_validate(payload.get("scene") or {})
        items: list[dict[str, Any]] = []
        seen: set[str] = set()

        def _add(info: Any) -> None:
            key = str(getattr(info, "key", "") or "")
            if not key or key in seen:
                return
            seen.add(key)
            items.append(info.model_dump(mode="json") if hasattr(info, "model_dump") else info)

        # Game-specific workflows registered on the factory (e.g. DW prepare_spells / level_up).
        factory_wfs = getattr(self, "workflows", None) or []
        if factory_wfs:
            for WF in factory_wfs:
                try:
                    for info in WF(self.codex).actions_for(scene, role):
                        _add(info)
                except Exception:
                    continue
        elif self.actions is not None:
            result = self.actions.list_actions(scene, role)
            for info in result:
                _add(info)

        for wf in getattr(self, "_common_workflow_instances", []):
            for info in wf.actions_for(scene, role):
                _add(info)

        return items

    def _handle_workflow_start(self, payload: dict[str, Any]) -> Any:
        action_key = payload.get("actionKey")
        action_context = ActionContext.model_validate(payload)
        result = self.workflow_router.start(action_key, action_context)
        return result.model_dump(mode="json") if hasattr(result, "model_dump") else result

    def _handle_workflow_submit(self, payload: dict[str, Any]) -> Any:
        action_key = payload.get("actionKey")
        action_context = ActionContext.model_validate(payload)
        result = self.workflow_router.submit(
            action_key=action_key,
            action_context=action_context,
        )
        return result.model_dump(mode="json") if hasattr(result, "model_dump") else result

    def _handle_workflow_patch(self, payload: dict[str, Any]) -> Any:
        action_key = payload.get("actionKey")
        action_context = ActionContext.model_validate(payload)
        result = self.workflow_router.patch(
            action_key=action_key,
            action_context=action_context,
        )
        return result.model_dump(mode="json") if hasattr(result, "model_dump") else result

    def _resolve_manager(self, entity: EntityKind):
        mapping = {
            "character": self.characters,
            "item": self.items,
            "npc": self.npcs,
            "location": self.locations,
            "obstacle": self.obstacles,
            "scene": self.scenes,
        }
        return mapping.get(entity)

    def _error(self, message: str) -> dict[str, Any]:
        return {
            "ok": False,
            "issues": [
                {
                    "path": "",
                    "message": message,
                    "icon": "error",
                    "level": "error",
                }
            ],
        }


class BasePlugin:
    plugin_id = "base"
    plugin_name = "Base Plugin"
    plugin_version = "0.1.0"
    parent_id: str | None = None

    factory_cls = BaseRulesFactory

    def get_factory(self):
        return self.factory_cls()

    def describe(self) -> dict[str, Any]:
        return {
            "id": self.plugin_id,
            "name": self.plugin_name,
            "version": self.plugin_version,
            "parent_id": self.parent_id,
        }