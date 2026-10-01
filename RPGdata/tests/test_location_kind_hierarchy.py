import asyncio
import importlib
import importlib.util
from pathlib import Path
from uuid import uuid4

import pytest

importlib.import_module("app.main")

from fastapi import HTTPException  # noqa: E402

from app import scheme  # noqa: E402
from app.constants.location_kinds import (  # noqa: E402
    LEGACY_KIND_ALIASES,
    LOCATION_KIND_CHILDREN,
    LOCATION_KIND_DESCENDANTS,
    LOCATION_KIND_IDS,
    LOCATION_KIND_LEVEL,
    LOCATION_KINDS,
    allowed_child_kinds,
    canonical_kind,
    kind_of,
    normalize_kind_tags,
    with_kind,
)
from app.routes.locations import _check_sublocation_kinds  # noqa: E402


def test_kinds_are_few_and_ordered_by_level():
    assert len(LOCATION_KINDS) == 8
    levels = [LOCATION_KIND_LEVEL[k] for k, _ in LOCATION_KINDS]
    assert levels == sorted(levels)
    assert set(LOCATION_KIND_LEVEL) == set(LOCATION_KIND_IDS)


def test_hierarchy_table_uses_known_kinds_only():
    assert set(LOCATION_KIND_CHILDREN) == set(LOCATION_KIND_IDS)
    for parent, children in LOCATION_KIND_CHILDREN.items():
        assert set(children) <= set(LOCATION_KIND_IDS), parent


def test_hierarchy_goes_down_and_is_reachable_from_world():
    seen, stack = set(), ["world"]
    while stack:
        k = stack.pop()
        if k in seen:
            continue
        seen.add(k)
        stack.extend(LOCATION_KIND_CHILDREN[k])
    assert seen == set(LOCATION_KIND_IDS)
    # мир и регион можно создать только «сверху»
    for parent, children in LOCATION_KIND_CHILDREN.items():
        assert "world" not in children
        assert "region" not in children or parent == "world"


def test_allowed_kinds_include_same_kind_and_descendants():
    # тот же вид, что у родителя, плюс потомки любой глубины
    assert set(allowed_child_kinds("city")) == {"city", "district", "building", "dungeon", "room"}
    assert set(allowed_child_kinds("world")) == set(LOCATION_KIND_IDS)
    assert set(allowed_child_kinds("region")) == {
        "region", "city", "wilds", "dungeon", "district", "building", "room",
    }
    assert set(allowed_child_kinds("district")) == {"district", "building", "dungeon", "room"}
    assert allowed_child_kinds("room") == ("room",)
    # порядок — как в иерархии: родитель раньше потомков
    assert allowed_child_kinds("region")[0] == "region"


def test_descendants_are_ordered_by_hierarchy_and_transitive():
    order = [k for k, _ in LOCATION_KINDS]
    for parent, desc in LOCATION_KIND_DESCENDANTS.items():
        assert list(desc) == [k for k in order if k in desc]
        for child in LOCATION_KIND_CHILDREN[parent]:
            assert child in desc
            assert set(LOCATION_KIND_DESCENDANTS[child]) <= set(desc)
        assert parent not in desc  # вид не вкладывается сам в себя


def test_no_parent_kind_means_no_restriction():
    assert set(allowed_child_kinds(None)) == set(LOCATION_KIND_IDS)
    assert set(allowed_child_kinds("unknown")) == set(LOCATION_KIND_IDS)


def test_legacy_kinds_map_to_current_ones():
    assert all(v is None or v in LOCATION_KIND_IDS for v in LEGACY_KIND_ALIASES.values())
    assert canonical_kind("street") == "district"
    assert canonical_kind("forest") == "wilds"
    assert canonical_kind("other") is None
    assert kind_of(["loc:village"]) == "city"
    # старый вид родителя ведёт себя как новый
    assert set(allowed_child_kinds("village")) == set(allowed_child_kinds("city"))


def test_with_kind_keeps_other_tags_and_single_kind():
    tags = with_kind(["start", "loc:city"], "room")
    assert tags == ["start", "loc:room"]
    assert kind_of(tags) == "room"
    assert with_kind(tags, None) == ["start"]
    assert with_kind(["a"], "no-such-kind") == ["a"]
    assert with_kind(["a"], "apartment") == ["a", "loc:room"]


def test_normalize_rewrites_or_drops_legacy_tags():
    assert normalize_kind_tags(["start", "loc:tavern"]) == ["start", "loc:building"]
    assert normalize_kind_tags(["loc:other", "x"]) == ["x"]


def _check(parent_tags, subs):
    return asyncio.run(_check_sublocation_kinds(None, uuid4(), None, parent_tags, subs))


def test_check_accepts_allowed_kinds_each_with_own_kind():
    subs = [
        scheme.SubLocationRef(name="Центр", kind="district"),
        scheme.SubLocationRef(name="Дом 5", kind="building"),
        scheme.SubLocationRef(name="Катакомбы", kind="dungeon"),
        scheme.SubLocationRef(name="Кладовая", kind="room"),  # внук: город -> здание -> комната
        scheme.SubLocationRef(name="Нижний город", kind="city"),  # тот же вид, что у родителя
        scheme.SubLocationRef(name="Без вида"),
    ]
    _check(["loc:city"], subs)


def test_check_rejects_kind_not_allowed_under_parent():
    with pytest.raises(HTTPException) as e:
        _check(["loc:city"], [scheme.SubLocationRef(name="Регион", kind="region")])
    assert e.value.status_code == 400
    with pytest.raises(HTTPException):
        _check(["loc:city"], [scheme.SubLocationRef(name="Мир", kind="world")])


def test_check_accepts_same_kind_as_parent():
    _check(["loc:region"], [scheme.SubLocationRef(name="Юг", kind="region")])
    _check(["loc:room"], [scheme.SubLocationRef(name="Кладовка", kind="room")])


def test_check_rejects_unknown_kind():
    with pytest.raises(HTTPException):
        _check([], [scheme.SubLocationRef(name="X", kind="bogus")])


def test_check_skips_when_parent_has_no_kind():
    _check(["start"], [scheme.SubLocationRef(name="X", kind="region")])


def test_check_maps_legacy_kind_from_old_clients():
    _check(["loc:city"], [scheme.SubLocationRef(name="Улица", kind="street")])


def test_kind_field_not_sent_is_not_validated_or_applied():
    sub = scheme.SubLocationRef(name="X")
    assert "kind" not in sub.model_fields_set
    _check(["loc:room"], [sub])


def _migration():
    path = Path(__file__).resolve().parents[1] / "alembic" / "versions" / "u0v1w2x3y4z5_location_kinds_reduced.py"
    spec = importlib.util.spec_from_file_location("mig_loc_kinds", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_migration_rewrite_matches_runtime_mapping():
    mig = _migration()
    assert mig._KINDS == set(LOCATION_KIND_IDS)
    assert mig._ALIASES == LEGACY_KIND_ALIASES
    assert mig._rewrite(["start", "loc:street"]) == ["start", "loc:district"]
    assert mig._rewrite(["loc:other"]) == []
    assert mig._rewrite(["loc:city", "loc:village"]) == ["loc:city"]
    assert mig._rewrite(["loc:room", "x"]) is None
    assert mig._rewrite([]) is None
