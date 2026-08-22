"""Tests for plugin schema / config split."""

import pytest

from plugins.common.protocols.editor_dispatch import manager_config, manager_schema, manager_init
from plugins.pbta.dungeon_world.base.backend.managers.characters_manager import CharactersManager
from plugins.pbta.dungeon_world.base.backend.codex import FullCodex
from app.routes.rules.schema_helpers import compute_schema_etag


@pytest.fixture
def dw_characters_manager():
    return CharactersManager(full_codex=FullCodex())


def test_schema_excludes_initial_data(dw_characters_manager):
    schema = manager_schema(dw_characters_manager, {})
    assert "initialData" not in schema
    assert "pbta" in schema
    assert "constraints" in schema


def test_config_includes_initial_data(dw_characters_manager):
    cfg = manager_config(dw_characters_manager, {})
    assert "initialData" in cfg
    assert "pbta" in cfg
    assert cfg["initialData"]["level"] == 1


def test_options_for_playbook(dw_characters_manager):
    opts = dw_characters_manager.options({"playbook_id": "fighter", "level": 1})
    assert opts["playbook_id"] == "fighter"
    assert isinstance(opts["allowed_move_ids"], list)
    assert len(opts["allowed_move_ids"]) > 0


def test_options_empty_without_playbook(dw_characters_manager):
    assert dw_characters_manager.options({}) == {}


def test_etag_is_stable(dw_characters_manager):
    schema = manager_schema(dw_characters_manager, {})
    a = compute_schema_etag(schema, "0.1.0")
    b = compute_schema_etag(schema, "0.1.0")
    assert a == b
    assert a.startswith('"')


def test_init_fallback_from_config_initial_data():
    class _Mgr:
        def config(self, context=None):
            return {"fields": [], "initialData": {"type": "clue", "name": ""}}

    assert manager_init(_Mgr(), {}) == {"type": "clue", "name": ""}


def test_init_empty_when_manager_has_no_init_or_initial_data():
    class _Mgr:
        def config(self, context=None):
            return {}

    assert manager_init(_Mgr(), {}) == {}
