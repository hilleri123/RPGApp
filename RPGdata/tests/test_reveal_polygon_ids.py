import importlib
from types import SimpleNamespace
from uuid import uuid4

importlib.import_module("app.main")

from app.managers.session.location_manager import reveal_polygon_ids  # noqa: E402


def _poly(poly_id, target=None):
    return SimpleNamespace(id=poly_id, target_location_id=target)


def _loc(loc_id, parent_id, polygons):
    return SimpleNamespace(id=loc_id, parent_location_id=parent_id, map_objects=polygons)


def test_reveal_polygon_on_parent_includes_polygons_of_target_children():
    parent = uuid4()
    city = uuid4()
    tavern = uuid4()
    on_parent = uuid4()
    on_tavern = uuid4()
    locations = [
        _loc(parent, None, [_poly(on_parent, target=city)]),
        _loc(city, parent, []),
        _loc(tavern, city, [_poly(on_tavern)]),
    ]

    assert reveal_polygon_ids(locations, on_parent) == {on_parent, on_tavern}


def test_reveal_polygon_stored_on_location_includes_its_children():
    city = uuid4()
    tavern = uuid4()
    on_city = uuid4()
    on_tavern = uuid4()
    locations = [
        _loc(city, None, [_poly(on_city)]),
        _loc(tavern, city, [_poly(on_tavern)]),
    ]

    assert reveal_polygon_ids(locations, on_city) == {on_city, on_tavern}
