from __future__ import annotations

from typing import Any

from .types import EntityKind
from .characters_manager import CharactersManager
from .items_manager import ItemsManager
from .actions_manager import ActionsManager

from .workflows import RollActionWorkflow, WorkflowRouter


class RulesFactory:
    system_id = "blades"

    def __init__(self) -> None:
        self.characters = CharactersManager()
        self.items = ItemsManager()
        self.actions = ActionsManager()

        self.roll_action = RollActionWorkflow()
        self.workflow_router = WorkflowRouter()
        self.workflow_router.register(
            "blades.roll_action",
            start=self.roll_action.start,
            present=self.roll_action.present,
            submit=self.roll_action.submit,
        )

    def handle(self, kind: str, entity: EntityKind, payload: Any, context: Any) -> Any:
        ctx = context if isinstance(context, dict) else {}
        p = payload or {}

        if kind == "actions.list":
            role = p.get("role")
            scene = p.get("scene") or {}
            res = self.actions.list_actions(scene, role)
            return [a.model_dump(mode="json") for a in res]

        if kind == "workflow.start":
            action_key = p.get("actionKey")
            res = self.workflow_router.start(action_key, payload=p)
            # оставляем ok для твоего SessionActionManager.create_action
            return res.model_dump(mode="json") if hasattr(res, "model_dump") else res

        if kind == "workflow.submit":
            action_key = p.get("actionKey")
            res = self.workflow_router.submit(
                action_key,
                scene=p.get("scene") or {},
                actor_user_id=p.get("actorUserId") or "",
                participants_dict=p.get("participants") or {},
                wf_dict=p.get("workflow") or {},
                input_dict=p.get("input") or {},
            )
            return res.model_dump(mode="json") if hasattr(res, "model_dump") else res

        # old entity routing
        if entity == "character":
            manager = self.characters
        elif entity == "item":
            manager = self.items
        elif entity in ("npc", "location", "obstacle"):
            return {
                "ok": True,
                "issues": [{
                    "path": "",
                    "message": f"Entity '{entity}' is not supported in Blades in the Dark plugin",
                    "icon": "error",
                    "level": "error",
                }],
            }
        else:
            return {"ok": False, "issues": [{"path": "", "message": "Unknown route", "icon": "error", "level": "error"}]}

        if kind == "config":
            return manager.config(ctx)

        if kind == "validate":
            res = manager.validate_and_enrich(payload or {}, ctx)
            return res.model_dump() if hasattr(res, "model_dump") else res.dict()

        return {"ok": False, "issues": [{"path": "", "message": "Unknown route", "icon": "error", "level": "error"}]}


class BladesPlugin:
    plugin_id = "blades_in_the_dark"
    plugin_name = "Blades in the Dark"
    plugin_version = "0.1.0"
    parent_id = None

    def get_factory(self):
        return RulesFactory()

    def describe(self):
        return {"id": self.plugin_id, "name": self.plugin_name, "version": self.plugin_version}


def create_plugin():
    return BladesPlugin()
