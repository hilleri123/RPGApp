from __future__ import annotations

import importlib
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .contracts import RulesPluginProto


def _purge_module_tree(prefix: str) -> None:
    for name in list(sys.modules.keys()):
        if name == prefix or name.startswith(prefix + "."):
            sys.modules.pop(name, None)


@dataclass
class LoadedDirPlugin:
    plugin: RulesPluginProto
    module_name: str
    plugin_root: Path
    loaded_at: float


class DirPluginRegistry:
    def __init__(self, plugins_dir: Path, plugins_package: str = "plugins") -> None:
        self.plugins_dir = plugins_dir
        self.plugins_package = plugins_package
        self._plugins: dict[str, LoadedDirPlugin] = {}

    def _module_name_from_path(self, plugin_py: Path) -> str:
        rel = plugin_py.relative_to(self.plugins_dir.parent)
        return ".".join(rel.with_suffix("").parts)

    def _import_plugin_module(
        self, plugin_py: Path, *, purge: bool = True
    ) -> tuple[RulesPluginProto, str]:
        module_name = self._module_name_from_path(plugin_py)

        prefix_parts = module_name.split(".")[:-2]  # убрать backend.plugin
        prefix = ".".join(prefix_parts)

        importlib.invalidate_caches()
        if purge:
            # Чистка нужна только для горячей перезагрузки. На первом импорте она
            # вредна: `plugins.pbta.base.backend.types` — общая библиотека
            # производных плагинов, и её пересоздание оставляет всем, кто уже
            # импортировал типы, устаревшие классы. Проверки isinstance через
            # границу плагина после этого молча не срабатывают.
            _purge_module_tree(prefix)

        module = importlib.import_module(module_name)

        create = getattr(module, "create_plugin", None)
        if not callable(create):
            raise RuntimeError(f"{module_name} must define create_plugin()")

        plugin = create()
        if not hasattr(plugin, "plugin_id") or not hasattr(plugin, "get_factory"):
            raise RuntimeError(f"{module_name} does not match RulesPluginProto")

        return plugin, module_name

    def load_all(self, *, purge: bool = False) -> None:
        self._plugins.clear()
        self.plugins_dir.mkdir(parents=True, exist_ok=True)

        root = str(self.plugins_dir.parent)
        if root not in sys.path:
            sys.path.insert(0, root)

        for plugin_py in sorted(self.plugins_dir.glob("**/backend/plugin.py")):
            try:
                plugin, module_name = self._import_plugin_module(plugin_py, purge=purge)
            except Exception as e:
                print(f"[registry] failed to load {plugin_py}: {e}")
                raise

            pid = plugin.plugin_id
            self._plugins[pid] = LoadedDirPlugin(
                plugin=plugin,
                module_name=module_name,
                plugin_root=plugin_py.parent.parent,
                loaded_at=time.time(),
            )

    def reload(self) -> None:
        self.load_all(purge=True)

    def list(self) -> list[dict[str, Any]]:
        out = []
        for p in self._plugins.values():
            plugin = p.plugin
            if hasattr(plugin, "describe"):
                out.append(plugin.describe())
            else:
                out.append({
                    "id": getattr(plugin, "plugin_id", None),
                    "name": getattr(plugin, "plugin_name", None),
                    "version": getattr(plugin, "plugin_version", None),
                })
        return out

    def get(self, plugin_id: str) -> RulesPluginProto:
        return self._plugins[plugin_id].plugin