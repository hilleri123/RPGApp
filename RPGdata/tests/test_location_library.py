"""Location kinds and library helpers (pure logic)."""

import uuid
from types import SimpleNamespace

import pytest

import app.main  # noqa: F401  (resolves circular imports)
from app.constants.location_kinds import LOCATION_KIND_IDS, is_kind_tag, kind_of, kind_tag
from app.services.location_library import _escape_like, descendants_of


def _loc(name, parent=None):
    return SimpleNamespace(id=uuid.uuid4(), name=name, parent_location_id=parent.id if parent else None)


def test_kind_roundtrip():
    assert kind_tag("city") == "loc:city"
    assert is_kind_tag("loc:city") and not is_kind_tag("city")
    assert kind_of(["x", "loc:apartment"]) == "apartment"
    assert kind_of(["loc:unknown"]) is None
    assert kind_of(None) is None
    assert {"island", "continent", "country", "city", "building", "apartment"} <= LOCATION_KIND_IDS


def test_descendants_root_first_breadth_first():
    city = _loc("Город")
    house = _loc("Дом", city)
    flat = _loc("Квартира", house)
    tavern = _loc("Таверна", city)
    other = _loc("Чужое")
    chain = descendants_of(city.id, [other, flat, tavern, house, city])
    assert [c.name for c in chain] == ["Город", "Дом", "Таверна", "Квартира"]


def test_descendants_survives_parent_cycle():
    a = _loc("A")
    b = _loc("B", a)
    a.parent_location_id = b.id  # цикл в данных
    assert {c.name for c in descendants_of(a.id, [a, b])} == {"A", "B"}


def test_descendants_unknown_root():
    assert descendants_of(uuid.uuid4(), [_loc("x")]) == []


def test_like_escape():
    assert _escape_like("50%_off") == r"50\%\_off"


def test_routes_are_authenticated(api_routes):
    from tests.conftest import dependency_names

    paths = {
        "/location_library",
        "/location_library/kinds",
        "/scenarios/{scenario_id}/locations/import",
    }
    found = [r for r in api_routes if r.path in paths]
    assert len(found) == 3
    for route in found:
        assert "require_master" in dependency_names(route), route.path
