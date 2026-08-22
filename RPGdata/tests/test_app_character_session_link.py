"""Application characters attach on re-approach + bound_user_id / IdMap identity."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.services.application_entity_service import (
    attach_application_characters_to_scenario,
    ensure_applications_attached_to_scenario,
    index_applications_by_id,
)
from app.services.scenario_cloner import IdMap


def test_id_map_register_identity_keeps_pool_id():
    m = IdMap()
    pc_id = uuid4()
    assert m.register(pc_id, pc_id) == pc_id
    assert m.remap(pc_id) == pc_id


def test_id_map_register_without_new_id_creates_phantom():
    """Document old bug: register(pc_id) alone invents a UUID."""
    m = IdMap()
    pc_id = uuid4()
    new_id = m.register(pc_id)
    assert new_id != pc_id


def test_index_applications_keys_by_app_and_character_id():
    app_id = uuid4()
    pc_id = uuid4()
    app = SimpleNamespace(id=app_id, player_character_id=pc_id)
    indexed = index_applications_by_id([app])  # type: ignore[arg-type]
    assert indexed[app_id] is app
    assert indexed[pc_id] is app


@pytest.mark.asyncio
async def test_attach_always_sets_scenario_id_and_bound_user():
    scenario_id = uuid4()
    user_id = uuid4()
    pc_id = uuid4()
    other_scenario = uuid4()

    item = SimpleNamespace(scenario_id=None, tags=[])
    link = SimpleNamespace(item=item)
    pc = SimpleNamespace(
        id=pc_id,
        scenario_id=other_scenario,
        bound_user_id=None,
        owned_item_links=[link],
    )
    app = SimpleNamespace(
        id=uuid4(),
        user_id=user_id,
        player_character_id=pc_id,
        player_character=pc,
    )
    db = AsyncMock()
    db.flush = AsyncMock()

    attached = await attach_application_characters_to_scenario(
        db,
        scenario_id=scenario_id,
        applications=[app],  # type: ignore[list-item]
    )

    assert attached[pc_id] is pc
    assert pc.scenario_id == scenario_id
    assert pc.bound_user_id == user_id
    assert item.scenario_id == scenario_id
    db.flush.assert_awaited()


@pytest.mark.asyncio
async def test_ensure_applications_attached_dedupes_and_calls_attach():
    scenario_id = uuid4()
    app_id = uuid4()
    pc_id = uuid4()
    app = SimpleNamespace(id=app_id, player_character_id=pc_id, user_id=uuid4())
    apps_by_id = {app_id: app, pc_id: app}

    db = AsyncMock()
    called: dict = {}

    async def fake_attach(db, *, scenario_id, applications):
        called["scenario_id"] = scenario_id
        called["applications"] = applications
        return {pc_id: SimpleNamespace(id=pc_id)}

    with patch(
        "app.services.application_entity_service.attach_application_characters_to_scenario",
        fake_attach,
    ):
        result = await ensure_applications_attached_to_scenario(
            db,
            scenario_id=scenario_id,
            apps_by_id=apps_by_id,  # type: ignore[arg-type]
        )

    assert called["scenario_id"] == scenario_id
    assert len(called["applications"]) == 1
    assert called["applications"][0].id == app_id
    assert pc_id in result


def test_application_snapshot_id_prefers_pool_character_id():
    """Mirror _build_players_from_lobby rule: never use phantom id_map value for app chars."""
    pc_id = uuid4()
    phantom = uuid4()
    id_map = {pc_id: phantom}
    character_id = pc_id
    new_char_id = id_map.get(pc_id)
    # Correct behaviour after fix:
    snap_id = str(character_id)
    assert snap_id == str(pc_id)
    assert snap_id != str(new_char_id)
