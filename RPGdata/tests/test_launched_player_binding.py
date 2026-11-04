"""Played character stays one row: the application points at it and does not replace it."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.services.application_entity_service import sync_application_character_from_application
from app.services.launched_player_service import bind_character_to_user


class _Result:
    def __init__(self, rows=None, one=None):
        self._rows = rows or []
        self._one = one

    def scalars(self):
        return self

    def all(self):
        return self._rows

    def scalar_one_or_none(self):
        return self._one


class _Db:
    def __init__(self, legacy=None):
        self.legacy = legacy
        self.added = []

    async def execute(self, _stmt):
        return _Result()

    async def get(self, _model, ident):
        if self.legacy is not None and ident == self.legacy.id:
            return self.legacy
        return None

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        return None


@pytest.mark.asyncio
async def test_sync_leaves_scenario_character_untouched():
    pc = SimpleNamespace(id=uuid4(), scenario_id=uuid4(), name="Сыгранный", data={"hp": 9})
    app = SimpleNamespace(player_character_id=pc.id, name="Старая заявка", data={})
    class _Found:
        def scalar_one_or_none(self):
            return pc.id

    db = AsyncMock()
    db.get = AsyncMock(return_value=pc)
    db.execute = AsyncMock(return_value=_Found())

    result = await sync_application_character_from_application(db, app)

    assert result is pc
    assert pc.name == "Сыгранный"
    assert pc.data == {"hp": 9}
    db.flush.assert_not_awaited()


@pytest.mark.asyncio
async def test_bind_links_application_to_the_same_character_row():
    user_id = uuid4()
    pc = SimpleNamespace(
        id=uuid4(),
        scenario_id=uuid4(),
        bound_user_id=None,
        name="Герой",
        short_desc="кратко",
        story="история",
        tags=["a"],
        data={"hp": 4},
        icon_url=None,
        img_url=None,
    )
    db = _Db()

    app = await bind_character_to_user(
        db,  # type: ignore[arg-type]
        pc=pc,  # type: ignore[arg-type]
        user_id=user_id,
        rule_id_str="dw",
        fields={"name": "Герой", "data": {"hp": 7}},
    )

    assert pc.bound_user_id == user_id
    assert app.player_character_id == pc.id
    assert app.user_id == user_id
    assert app.data["hp"] == 7
    assert db.added == [app]
    assert not any(type(obj).__name__ == "PlayerCharacter" for obj in db.added)


@pytest.mark.asyncio
async def test_bind_reuses_legacy_application_with_character_id():
    user_id = uuid4()
    pc_id = uuid4()
    legacy = SimpleNamespace(
        id=pc_id,
        user_id=uuid4(),
        player_character_id=None,
        name="Слепок",
        data={},
        rule_id_str="dw",
        source_kind=None,
        source_session_id=None,
        source_player_id=None,
        is_result_snapshot=False,
    )
    pc = SimpleNamespace(
        id=pc_id,
        scenario_id=uuid4(),
        bound_user_id=None,
        name="Герой",
        short_desc=None,
        story=None,
        tags=[],
        data={"hp": 3},
        icon_url=None,
        img_url=None,
    )
    db = _Db(legacy=legacy)

    app = await bind_character_to_user(
        db,  # type: ignore[arg-type]
        pc=pc,  # type: ignore[arg-type]
        user_id=user_id,
        rule_id_str="dw",
    )

    assert app is legacy
    assert legacy.player_character_id == pc_id
    assert legacy.user_id == user_id
    assert db.added == []
