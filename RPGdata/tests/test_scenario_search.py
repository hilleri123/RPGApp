"""Scenario search: snippets, type coverage, auth."""

import pytest

import app.main  # noqa: F401  (resolves circular imports)
from app.services.scenario_search import SEARCH_TYPES, make_snippet


def test_snippet_centers_on_match_and_strips_html():
    text = "<p>" + "а" * 200 + " ДРАКОН спит " + "б" * 200 + "</p>"
    snip = make_snippet([text], "дракон")
    assert "ДРАКОН" in snip and "<" not in snip
    assert snip.startswith("…") and snip.endswith("…")
    assert len(snip) < 200


def test_snippet_falls_back_to_start_without_match():
    assert make_snippet(["Начало текста", "другое"], "zzz") == "Начало текста"


def test_snippet_empty():
    assert make_snippet([None, ""], "x") == ""


def test_covers_every_entity_tab():
    assert {"story_beat", "location", "npc", "game_item", "player_character", "note", "counter", "front"} == set(
        SEARCH_TYPES
    )


def test_search_route_requires_master(api_routes):
    from tests.conftest import dependency_names

    route = next(r for r in api_routes if r.path == "/scenarios/{scenario_id}/search")
    assert "require_master" in dependency_names(route)
