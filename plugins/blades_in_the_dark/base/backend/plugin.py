# plugin.py
from __future__ import annotations

from typing import Any

from .types import EntityKind
from .characters_manager import CharactersManager
from .items_manager import ItemsManager
from .actions_manager import ActionsManager
from .workflows import RollActionWorkflow

class RulesFactory:
    system_id = "blades"

    def __init__(self) -> None:
        self.characters = CharactersManager()
        self.items = ItemsManager()
        self.actions = ActionsManager()
        self.roll_action = RollActionWorkflow()

    def handle(self, kind: str, entity: EntityKind, payload: Any, context: Any) -> Any:
        ctx = context if isinstance(context, dict) else {}
        # --- NEW: actions.list ---
        if kind == "actions.list":
            role = payload.get("role")  # "gm"|"initiator"|"player"
            # ты передаешь {"scene": scene_dump, "role": ...}
            scene = payload.get("scene") or {}
            res = self.actions.list_actions(scene, role)
            return [a.model_dump(mode="json") for a in res]
        
        # --- NEW: workflow routes ---
        p = payload or {}

        if kind == "workflow.start":
            action_key = p.get("actionKey")
            scene = p.get("scene") or {}
            if action_key == "blades.roll_action":
                wf = self.roll_action.start(scene)
                d = wf.model_dump(mode="json")
                d["ok"] = True              # чтобы SessionActionManager прошёл check
                return d
            return {"ok": False, "issues": [{"path": "actionKey", "message": "Unknown actionKey", "level": "error"}]}

        if kind == "workflow.present":
            action_key = p.get("actionKey")
            scene = p.get("scene") or {}
            role = p.get("role")
            wf = p.get("workflow") or {}
            if action_key == "blades.roll_action":
                env = self.roll_action.present(scene, role, wf)
                return env.model_dump(mode="json")
            return {"ok": False, "issues": [{"path": "actionKey", "message": "Unknown actionKey", "level": "error"}]}

        if kind == "workflow.submit":
            action_key = p.get("actionKey")
            scene = p.get("scene") or {}
            role = p.get("role")
            wf = p.get("workflow") or {}
            inp = p.get("input") or {}
            if action_key == "blades.roll_action":
                res = self.roll_action.submit(scene, role, wf, inp)
                return res.model_dump(mode="json")
            return {"ok": False, "issues": [{"path": "actionKey", "message": "Unknown actionKey", "level": "error"}]}

        # --- old entity routing ---
        if entity == "character":
            manager = self.characters
        elif entity == "item":
            manager = self.items
        elif entity in ("npc", "location", "obstacle"):
            return {
                "ok": False,
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
