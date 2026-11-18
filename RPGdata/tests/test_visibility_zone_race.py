"""Две пересборки одной зоны не идут вперемешку; кэш сущностей сбрасывают только их строки."""

from __future__ import annotations

import asyncio
import uuid
from types import SimpleNamespace

import pytest

import app.main  # noqa: F401  (resolves circular imports)
from app.services import visibility_service
from app.services.change_scheduler import entities_changed


@pytest.mark.asyncio
async def test_rebuilds_of_one_zone_do_not_overlap(monkeypatch):
    running = 0
    peak = 0

    async def slow_rebuild(*_args):
        nonlocal running, peak
        running += 1
        peak = max(peak, running)
        await asyncio.sleep(0.01)
        running -= 1

    monkeypatch.setattr(visibility_service, "_rebuild_for_user", slow_rebuild)
    session_id, user_id = uuid.uuid4(), uuid.uuid4()
    await asyncio.gather(
        visibility_service.rebuild_for_user(session_id, user_id, "master"),
        visibility_service.rebuild_for_user(session_id, user_id, "master"),
        visibility_service.rebuild_for_user(session_id, uuid.uuid4(), "player"),
    )
    # Своя зона — по очереди; чужая может идти параллельно.
    assert peak == 2


def test_only_entity_rows_reset_entity_cache():
    row = lambda t, op="updated": SimpleNamespace(object_type=t, op=op)  # noqa: E731
    assert entities_changed([row("npc")]) is True
    assert entities_changed([row("scene"), row("action"), row("log"), row("inventory")]) is False
    assert entities_changed([row("npc", "gone"), row("game_item", "appeared")]) is False
