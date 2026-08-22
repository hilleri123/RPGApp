from typing import Optional
from app.plugins.contracts import RulesPluginProto
from .gumshoe import create_plugin as create_plugin_gumshoe
from .blades_in_the_dark import create_plugin as create_plugin_blades_in_the_dark

plugins: dict[str, RulesPluginProto] = {}

def get_plugin(name: str) -> Optional[RulesPluginProto]:
    if name not in plugins:
        if name == "gumshoe":
            plugins[name] = create_plugin_gumshoe()
        elif name == "blades_in_the_dark":
            plugins[name] = create_plugin_blades_in_the_dark()
        else:
            return None
    
    print(5*("!"*40 + "\n"), plugins, name)
    return plugins[name]
