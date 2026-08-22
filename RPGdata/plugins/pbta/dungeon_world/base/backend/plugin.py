from __future__ import annotations

from plugins.common.protocols import BasePlugin
from plugins.pbta.base.backend.plugin import BaseRulesFactory, PbtaBasePlugin

from .codex import FullCodex
from .managers import (
    ActionsManager,
    CharactersManager,
    ItemsManager,
    LocationManager,
    NpcsManager,
    ObstaclesManager,
    ScenesManager,
)
from .workflows import workflows as default_workflows


class RulesFactory(BaseRulesFactory):
    system_id = "dungeon_world"

    codex_cls = FullCodex

    actions_manager_cls = ActionsManager
    items_manager_cls = ItemsManager
    characters_manager_cls = CharactersManager
    npcs_manager_cls = NpcsManager
    locations_manager_cls = LocationManager
    obstacles_manager_cls = ObstaclesManager
    scenes_manager_cls = ScenesManager

    workflows = default_workflows


class DungeonWorldPlugin(BasePlugin):
    plugin_id = "dungeon_world"
    plugin_name = "Dungeon World"
    plugin_version = "0.1.0"
    parent_id = PbtaBasePlugin.plugin_id
    factory_cls = RulesFactory


def create_plugin():
    return DungeonWorldPlugin()