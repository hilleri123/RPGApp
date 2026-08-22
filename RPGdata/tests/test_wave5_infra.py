"""Regression tests for wave 5: infrastructure config and plugin loading.

Covers the plugin loader that purged already-imported modules on the very first
load (which made isinstance checks across the plugin boundary silently fail —
the root cause of INF-09), the /health endpoint used by compose healthchecks,
and .env.example drifting away from the variables the code actually reads.
"""

from __future__ import annotations

import importlib
import inspect
import pathlib
import re

import pytest


def _module(name: str):
    importlib.import_module("app.main")
    return importlib.import_module(name)


def _repo_root() -> pathlib.Path:
    """RPGdata лежит внутри монорепозитория, конфиги — на уровень выше."""
    return pathlib.Path(_module("app.main").__file__).parent.parent.parent


# --- INF-09: устаревшие классы после перезагрузки плагинов -----------------


def test_first_load_does_not_purge_imported_modules():
    """`plugins.pbta.base.backend.types` — общая библиотека производных
    плагинов. Её пересоздание оставляет всем, кто уже импортировал типы,
    устаревшие классы, и isinstance через границу плагина молча ломается."""
    loader = _module("app.plugins.dir_loader")

    sig = inspect.signature(loader.DirPluginRegistry.load_all)
    assert sig.parameters["purge"].default is False


def test_reload_still_purges():
    """Горячая перезагрузка без чистки бессмысленна — она и должна подменять
    модули."""
    loader = _module("app.plugins.dir_loader")
    src = inspect.getsource(loader.DirPluginRegistry.reload)

    assert "purge=True" in src


def test_move_grants_survive_class_identity_mismatch():
    """Раньше ход с нераспознанным классом молча выдавал ноль ресурсов."""
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.helpers import (
        iter_move_grants,
    )

    class _AlienGrant:
        """Двойник MoveGrantResource из другой копии модуля типов."""

        def model_dump(self):
            return {
                "spec_id": "forward",
                "amount": 1,
                "on_tier": ["10_plus"],
                "target": "self",
            }

    class _Move:
        id = "probe_move"
        grant_resources = [_AlienGrant()]

    grants = iter_move_grants(_Move())
    assert len(grants) == 1
    assert grants[0].spec_id == "forward"


def test_bard_arcane_art_grants_forward_after_plugin_load():
    """Именно этот ход падал при полном прогоне в зависимости от порядка."""
    from plugins.pbta.dungeon_world.base.backend.codex import FullCodex
    from plugins.pbta.dungeon_world.base.backend.workflows.perform_move.helpers import (
        iter_move_grants,
    )

    move = FullCodex().moves.moves_map()["bard_arcane_art"]
    grants = iter_move_grants(move)

    assert [g.spec_id for g in grants] == ["forward"]


# --- INF-03: healthcheck --------------------------------------------------


def test_health_endpoint_exists_and_is_open():
    app = _module("app.main").app
    routes = [r for r in app.routes if getattr(r, "path", None) == "/health"]

    assert len(routes) == 1
    # Healthcheck внутри контейнера не носит куки, поэтому никаких зависимостей.
    assert routes[0].dependant.dependencies == []


@pytest.mark.asyncio
async def test_health_returns_ok():
    main = _module("app.main")
    assert await main.health() == {"status": "ok"}


@pytest.mark.parametrize("compose_file", ["compose.dev.yml", "compose.prod.yml"])
def test_app_service_has_healthcheck(compose_file):
    path = _repo_root() / compose_file
    if not path.exists():
        pytest.skip(f"{compose_file} недоступен из окружения тестов")

    assert "/health" in path.read_text(), f"{compose_file}: healthcheck у app отсутствует"


# --- INF-05: .env.example расходится с кодом ------------------------------


def _env_vars_read_by_code() -> set[str]:
    app_dir = pathlib.Path(_module("app.main").__file__).parent
    pattern = re.compile(r"os\.(?:getenv|environ\.get)\(\s*['\"]([A-Z_]{3,})['\"]")
    found: set[str] = set()
    for py in app_dir.rglob("*.py"):
        found |= set(pattern.findall(py.read_text()))
    return found


def test_env_example_covers_every_variable_code_reads():
    """Кто разворачивает проект по примеру, не должен молча получить дефолты:
    неверный MEDIA_ROOT отправит загрузки не туда, где их ждёт раздача."""
    example = _repo_root() / ".env.example"
    if not example.exists():
        pytest.skip(".env.example недоступен из окружения тестов")

    documented = {
        line.split("=", 1)[0].strip()
        for line in example.read_text().splitlines()
        if line.strip() and not line.strip().startswith("#") and "=" in line
    }

    # Мёртвая инфраструктура (INF-07) документироваться не должна.
    dead = {"MONGODB_URL", "KAFKA_BOOTSTRAP_SERVERS"}
    required = _env_vars_read_by_code() - dead

    missing = sorted(required - documented)
    assert missing == [], f"не описаны в .env.example: {missing}"
