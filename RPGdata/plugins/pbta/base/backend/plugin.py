from __future__ import annotations

from plugins.common.protocols import BasePlugin, BaseRulesFactory

from .codex import PbtaFullCodex
from .managers import (
    ActionsManager,
    CharactersManager,
    ItemsManager,
    LocationManager,
    NpcsManager,
    ObstaclesManager,
    ScenesManager
)
from .workflows import workflows as default_workflows


class RulesFactory(BaseRulesFactory):
    system_id = "pbta_base"

    codex_cls = PbtaFullCodex

    actions_manager_cls = ActionsManager
    items_manager_cls = ItemsManager
    characters_manager_cls = CharactersManager
    npcs_manager_cls = NpcsManager
    locations_manager_cls = LocationManager
    obstacles_manager_cls = ObstaclesManager
    scenes_manager_cls = ScenesManager

    workflows = default_workflows


class PbtaBasePlugin(BasePlugin):
    plugin_id = "pbta_base"
    plugin_name = "PbtA Base"
    plugin_version = "0.1.0"
    parent_id = None
    factory_cls = RulesFactory


def create_plugin():
    return PbtaBasePlugin()