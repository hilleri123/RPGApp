from typing import Optional
from app.plugins.contracts import RulesPluginProto
from .gumshoe import create_plugin

plugins: dict[str, RulesPluginProto] = {}

def get_plugin(name: str) -> Optional[RulesPluginProto]:
    if name not in plugins:
        if name == "gumshoe":
            plugins[name] = create_plugin()
        else:
            return None
    return plugins[name]
