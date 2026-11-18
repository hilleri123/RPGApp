"""Игрок в лобби берёт только персонажа сценария, свободного, или свою заявку."""

from __future__ import annotations

import importlib
import uuid
from types import SimpleNamespace

import pytest

import app.main  # noqa: F401  (resolves circular imports)
from app.services import launched_scenario_service as launched_svc

# app.managers.lobby_manager в пакете перекрыт экземпляром менеджера.
lobby_module = importlib.import_module("app.managers.lobby_manager")


class _FakeJson:
    def __init__(self, doc: dict) -> None:
        self.doc = doc

    async def get(self, key, path=None):
        if path is None:
            return self.doc
        return self.doc.get(str(path).lstrip("."))

    async def set(self, key, path, value):
        self.doc[str(path).lstrip(".")] = value


class _FakeRedis:
    def __init__(self, doc: dict) -> None:
        self._json = _FakeJson(doc)

    def json(self):
        return self._json


def _player(user_id, character_id=None):
    return {
        "id": str(uuid.uuid4()),
        "user": {"id": str(user_id)},
        "character_id": str(character_id) if character_id else None,
    }


def _lobby(monkeypatch, doc):
    monkeypatch.setattr(lobby_module, "redis_client", _FakeRedis(doc))
    return lobby_module.CurrentLobbyManager(str(uuid.uuid4()))


@pytest.mark.asyncio
async def test_character_outside_scenario_is_rejected(monkeypatch):
    me = uuid.uuid4()
    doc = {"characters": [{"id": str(uuid.uuid4())}], "players": [_player(me)]}
    mgr = _lobby(monkeypatch, doc)
    assert await mgr.player_select_character(SimpleNamespace(id=me), uuid.uuid4()) is False
    assert doc["players"][0]["character_id"] is None


@pytest.mark.asyncio
async def test_character_taken_by_other_player_is_rejected(monkeypatch):
    me, other = uuid.uuid4(), uuid.uuid4()
    hero = uuid.uuid4()
    doc = {
        "characters": [{"id": str(hero)}],
        "players": [_player(other, hero), _player(me)],
    }
    mgr = _lobby(monkeypatch, doc)
    assert await mgr.player_select_character(SimpleNamespace(id=me), hero) is False
    assert doc["players"][1]["character_id"] is None


@pytest.mark.asyncio
async def test_free_scenario_character_is_taken(monkeypatch):
    me = uuid.uuid4()
    hero = uuid.uuid4()
    doc = {"characters": [{"id": str(hero)}], "players": [_player(me)]}
    mgr = _lobby(monkeypatch, doc)
    assert await mgr.player_select_character(SimpleNamespace(id=me), hero) is True
    assert doc["players"][0]["character_id"] == str(hero)


class _Rows:
    def __init__(self, rows) -> None:
        self.rows = rows

    def scalars(self):
        return self

    def all(self):
        return self.rows


class _SeqDb:
    def __init__(self, *results) -> None:
        self.results = list(results)

    async def execute(self, stmt):
        return _Rows(self.results.pop(0))


@pytest.mark.asyncio
async def test_foreign_application_is_not_taken_at_start():
    me, stranger = uuid.uuid4(), uuid.uuid4()
    foreign_pc = uuid.uuid4()
    foreign_app = SimpleNamespace(
        id=uuid.uuid4(), player_character_id=foreign_pc, user_id=stranger
    )
    lobby = SimpleNamespace(
        players=[SimpleNamespace(character_id=foreign_pc, user=SimpleNamespace(id=me))]
    )
    # Заявка нашлась по id, но она чужая; среди персонажей сценария его тоже нет.
    db = _SeqDb([foreign_app], [])
    apps, chars = await launched_svc._load_lobby_character_lookups(
        db, lobby, scenario_id=uuid.uuid4()
    )
    assert apps == {}
    assert chars == {}


@pytest.mark.asyncio
async def test_own_application_is_taken_at_start():
    me = uuid.uuid4()
    pc = uuid.uuid4()
    app_row = SimpleNamespace(id=uuid.uuid4(), player_character_id=pc, user_id=me)
    lobby = SimpleNamespace(
        players=[SimpleNamespace(character_id=pc, user=SimpleNamespace(id=me))]
    )
    apps, chars = await launched_svc._load_lobby_character_lookups(
        _SeqDb([app_row]), lobby, scenario_id=uuid.uuid4()
    )
    assert apps[pc] is app_row
    assert chars == {}
