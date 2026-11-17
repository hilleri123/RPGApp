"""Пересборка зоны и чтение тел не порождают новых записей журнала сами по себе."""

from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest

import app.main  # noqa: F401  (resolves circular imports)
from app.services import object_bodies, visibility_service
from app.services.change_scheduler import inventory_changed


def test_zone_rows_do_not_trigger_rebuild():
    zone_rows = [
        SimpleNamespace(object_type="inventory", op="gone"),
        SimpleNamespace(object_type="inventory", op="appeared"),
    ]
    assert inventory_changed(zone_rows) is False
    assert inventory_changed([SimpleNamespace(object_type="inventory", op="updated")]) is True


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["master", "player"])
async def test_inventories_are_part_of_the_wanted_zone(monkeypatch, role):
    inventory = ("inventory", uuid.uuid4())
    inner = SimpleNamespace(scenario_id=uuid.uuid4(), players=[])
    seen: list[set] = []

    async def ensure(session_id):
        async def get_inner():
            return inner
        return SimpleNamespace(get_inner=get_inner)

    async def inventory_keys(_arg):
        return {inventory}

    async def replace_zone(session_id, user_id, wanted):
        seen.append(set(wanted))

    from app.managers import session_manager

    monkeypatch.setattr(session_manager, "ensure_manager", ensure)
    monkeypatch.setattr(visibility_service, "wanted_ids", lambda *a, **k: set())
    monkeypatch.setattr(visibility_service, "_scenario_inventory_keys", inventory_keys)
    monkeypatch.setattr(visibility_service, "_player_inventory_keys", inventory_keys)
    monkeypatch.setattr(visibility_service, "replace_zone", replace_zone)

    await visibility_service.rebuild_for_user(uuid.uuid4(), uuid.uuid4(), role)
    # Одна сверка с инвентарём внутри: нечего удалять и тут же добавлять обратно.
    assert seen == [{inventory}]


@pytest.mark.asyncio
async def test_scene_read_refreshes_actions_without_saving():
    wanted, other = uuid.uuid4(), uuid.uuid4()
    scenes = [
        SimpleNamespace(id=wanted, available_actions_by_role={"gm": []}),
        SimpleNamespace(id=other, available_actions_by_role={"gm": []}),
    ]
    recomputed: list = []

    class _Manager:
        async def _recompute_available_actions_for_scene(self, inner, scene):
            recomputed.append(scene.id)

        async def _save_scenes(self, scenes):
            raise AssertionError("GET /objects must not write scenes")

    await object_bodies._refresh_scene_actions(
        _Manager(), SimpleNamespace(scenes=scenes), {str(wanted)}
    )
    assert recomputed == [wanted]
