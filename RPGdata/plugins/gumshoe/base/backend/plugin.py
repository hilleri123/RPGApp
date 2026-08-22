from __future__ import annotations
from typing import Any
from .codex import FullCodex
from .items_manager import ItemsManager
from .characters_manager import CharactersManager
from .npcs_manager import NpcsManager
from .location_manager import LocationManager
from .obstacles_manager import ObstaclesManager
from .scenes_manager import ScenesManager
from .actions_manager import ActionsManager

from .workflows import workflows
from plugins.common.protocols import WorkflowRouter
from plugins.common.protocols.editor_dispatch import dispatch_manager_kind

from plugins.common.types import EntityKind, SceneContext, ActionContext

class RulesFactory:
    system_id = "gumshoe"

    def __init__(self) -> None:
        self.codex = FullCodex()
        self.actions = ActionsManager(self.codex)
        self.items = ItemsManager()
        self.characters = CharactersManager(self.codex)
        self.npcs = NpcsManager(self.codex)
        self.locations = LocationManager()
        self.obstacles = ObstaclesManager(self.codex)
        self.scenes = ScenesManager()

        self.workflow_router = WorkflowRouter(self.codex)
        for w in workflows:
            self.workflow_router.register(w)

    # единый диспетчер, чтобы бэк не знал типов
    def handle(self, kind: str, entity: EntityKind, payload: Any, context: Any) -> Any:
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

        manager = None

        if entity == "character":
            manager = self.characters
        elif entity == "item":
            manager = self.items
        elif entity == "npc":
            manager = self.npcs
        elif entity == "location":
            manager = self.locations
        elif entity == "obstacle":
            manager = self.obstacles
        elif entity == "scene":
            manager = self.scenes
        else:
            return {"ok": False, "issues": [{"path": "", "message": "Unknown route", "icon": "error", "level": "error"}]}

        try:
            return dispatch_manager_kind(manager, kind, payload, ctx)
        except ValueError:
            return {"ok": False, "issues": [{"path": "", "message": "Unknown route", "icon": "error", "level": "error"}]}

class GumshoePlugin:
    plugin_id = "gumshoe"
    plugin_name = "GUMSHOE"
    plugin_version = "0.1.0"
    parent_id = None

    def get_factory(self):
        return RulesFactory()
    
    def describe(self):
        return {
            "id": self.plugin_id,
            "name": self.plugin_name,
            "version": self.plugin_version,
        }

def create_plugin():
    return GumshoePlugin()
