from __future__ import annotations
from typing import Any
from .codex_skills import SkillsCodex
from .items_manager import ItemsManager
from .characters_manager import CharactersManager
from .npcs_manager import NpcsManager
from .location_manager import LocationManager
from .obstacles_manager import ObstaclesManager

class RulesFactory:
    system_id = "example"

    def __init__(self) -> None:
        self.skills = SkillsCodex()
        self.items = ItemsManager()
        self.characters = CharactersManager(self.skills)
        self.npcs = NpcsManager(self.skills)
        self.locations = LocationManager()
        self.obstacles = ObstaclesManager(self.skills)

    # единый диспетчер, чтобы бэк не знал типов
    def handle(self, kind: str, entity: str, payload: Any, context: Any) -> Any:
        ctx = context if isinstance(context, dict) else {}

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
        else:
            return {"ok": False, "issues": [{"path": "", "message": "Unknown route", "icon": "error", "level": "error"}]}

        if kind == "config":
            return manager.config(ctx)
        if kind == "validate":
            res = manager.validate_and_enrich(payload or {}, ctx)
            return res.model_dump() if hasattr(res, "model_dump") else res.dict()

        return {"ok": False, "issues": [{"path": "", "message": "Unknown route", "icon": "error", "level": "error"}]}

class GumshoePlugin:
    plugin_id = "gumshoe"
    plugin_name = "Example Rules"
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
