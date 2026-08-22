# plugin.py
from __future__ import annotations

from typing import Any

from .characters_manager import CharactersManager
from .actions_manager import ActionsManager
from .scenes_manager import ScenesManager
from .workflows import workflows
from plugins.common.protocols import WorkflowRouter
from plugins.common.protocols.editor_dispatch import dispatch_manager_kind
from plugins.common.types import ActionContext, SceneContext, EntityKind


class RulesFactory:
    system_id = "everyone_is_john"

    def __init__(self) -> None:
        self.characters = CharactersManager()
        self.actions = ActionsManager()
        self.scenes = ScenesManager()
        self.workflow_router = WorkflowRouter()
        for w in workflows:
            self.workflow_router.register(w())


    def handle(self, kind: str, entity: EntityKind, payload: Any = None, context: Any = None) -> Any:
        ctx = context if isinstance(context, dict) else {}
        p = payload or {}

        if kind == "actions.list":
            role = p.get("role")
            scene = SceneContext.model_validate(p.get("scene") or {})
            res = self.actions.list_actions(scene, role)
            return [a.model_dump(mode="json") for a in res]

        if kind == "workflow.start":
            action_key = p.get("actionKey")
            action_context = ActionContext.model_validate(p)
            res = self.workflow_router.start(action_key, action_context)
            # оставляем ok для твоего SessionActionManager.create_action
            return res.model_dump(mode="json") if hasattr(res, "model_dump") else res

        if kind == "workflow.submit":
            action_key = p.get("actionKey")
            action_context = ActionContext.model_validate(p)
            res = self.workflow_router.submit(
                action_key,
                action_context=action_context,
            )
            return res.model_dump(mode="json") if hasattr(res, "model_dump") else res


        # entity routing
        if entity == "character":
            manager = self.characters
        elif entity == "scene":
            manager = self.scenes
        elif entity in ("npc", "item", "location", "obstacle",):
            return {
                "ok": True,
                "issues": [{
                    "path": "",
                    "message": f"Entity '{entity}' is not supported yet in grudge_dwarves plugin",
                    "icon": "error",
                    "level": "error",
                }],
            }
        else:
            return {"ok": False, "issues": [{"path": "", "message": "Unknown route", "icon": "error", "level": "error"}]}

        try:
            return dispatch_manager_kind(manager, kind, payload, ctx)
        except ValueError:
            return {"ok": False, "issues": [{"path": "", "message": "Unknown route", "icon": "error", "level": "error"}]}


class GrudgeDwarvesPlugin:
    plugin_id = "everyone_is_john"
    plugin_name = "Everyone is John"
    plugin_version = "0.1.0"
    parent_id = None

    def get_factory(self):
        return RulesFactory()

    def describe(self):
        return {"id": self.plugin_id, "name": self.plugin_name, "version": self.plugin_version}


def create_plugin():
    return GrudgeDwarvesPlugin()
