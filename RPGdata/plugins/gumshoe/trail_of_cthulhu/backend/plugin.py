from __future__ import annotations
from typing import Any
from .codex import FullCodex
from .characters_manager import CharactersManager
from .npcs_manager import NpcsManager
from .obstacles_manager import ObstaclesManager
from .actions_manager import ActionsManager
from plugins.common.types import EntityKind

from plugins.common.protocols import WorkflowRouter

from ...base.backend.plugin import RulesFactory as BaseRulesFactory
from .workflows import workflows


class RulesFactory(BaseRulesFactory):
    system_id = "gumshoe"

    def __init__(self) -> None:
        super().__init__()
        self.codex = FullCodex()
        self.actions = ActionsManager(self.codex)
        self.characters = CharactersManager(self.codex)
        self.npcs = NpcsManager(self.codex)
        self.obstacles = ObstaclesManager(self.codex)

        self.workflow_router = WorkflowRouter(self.codex)
        for w in workflows:
            self.workflow_router.register(w)


class GumshoePlugin:
    plugin_id = "trail_of_cthulhu"
    plugin_name = "Trail of Cthulhu"
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
