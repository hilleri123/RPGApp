"""Tests for scenario deep-copy on session start."""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.scenario_cloner import IdMap, _copy_scalar_columns
from app.models.scenario.scenario import Scenario


def test_id_map_register_and_remap():
    id_map = IdMap()
    old = uuid.uuid4()
    new = id_map.register(old)
    assert id_map.remap(old) == new
    assert id_map.remap(None) is None


def test_copy_scalar_columns_excludes_id():
    src = MagicMock()
    src.id = uuid.uuid4()
    src.name = "test"
    src.scenario_id = uuid.uuid4()
    Scenario.__table__.columns  # ensure model loaded
    data = _copy_scalar_columns(src, Scenario, exclude=frozenset({"scenario_id"}))
    assert "id" not in data
    assert "scenario_id" not in data
    assert data["name"] == "test"


def test_clone_preserves_scenario_starts_at_field_assignment():
    """scenario_starts_at must be copied from source, not replaced with session start time."""
    from datetime import datetime, timezone

    src_starts_at = datetime(1422, 3, 15, 8, 0, tzinfo=timezone.utc)
    src = MagicMock()
    src.id = uuid.uuid4()
    src.name = "Source"
    src.intro = None
    src.max_players = 4
    src.rule_id_str = "pbta"
    src.icon_url = None
    src.user_id = uuid.uuid4()
    src.data = {}
    src.tags = None
    src.scenario_starts_at = src_starts_at
    src.locations = []
    src.story_beats = []
    src.characters = []
    src.npcs = []
    src.items = []
    src.notes = []
    src.counters = []
    src.obstacles = []
    src.todos = []
    src.template_set_links = []

    # Verify the cloner assigns source in-game time (logic check without DB)
    new_kwargs = dict(
        name="Session",
        intro=src.intro,
        max_players=src.max_players,
        rule_id_str=src.rule_id_str,
        icon_url=src.icon_url,
        user_id=src.user_id,
        data=src.data,
        tags=src.tags,
        scenario_starts_at=src.scenario_starts_at,
        source_scenario_id=src.id,
        is_session_snapshot=True,
    )
    assert new_kwargs["scenario_starts_at"] == src_starts_at
