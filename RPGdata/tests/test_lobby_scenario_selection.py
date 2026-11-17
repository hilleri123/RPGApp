"""Мастер лобби выбирает только доступные ему сценарий, кампанию и партию."""

from __future__ import annotations

import uuid
import importlib
from types import SimpleNamespace

import pytest

import app.main  # noqa: F401  (resolves circular imports)

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


class _Result:
    def __init__(self, value) -> None:
        self.value = value

    def scalars(self):
        return self

    def first(self):
        return self.value


class _FakeDb:
    def __init__(self, scenario=None, objects: dict | None = None) -> None:
        self.scenario = scenario
        self.objects = objects or {}

    async def execute(self, stmt):
        return _Result(self.scenario)

    async def get(self, model, key):
        return self.objects.get(key)

    async def commit(self):
        pass


def _use(monkeypatch, doc: dict, db: _FakeDb):
    async def fake_get_db():
        yield db

    monkeypatch.setattr(lobby_module, "redis_client", _FakeRedis(doc))
    monkeypatch.setattr(lobby_module, "get_db", fake_get_db)


def _user(**kw):
    return SimpleNamespace(id=uuid.uuid4(), is_admin=False, **kw)


@pytest.mark.asyncio
async def test_scenario_without_access_is_rejected(monkeypatch):
    doc = {"launched_scenario_id": "keep"}
    _use(monkeypatch, doc, _FakeDb(SimpleNamespace(is_session_snapshot=False)))

    async def no_access(db, user, scenario):
        return False

    monkeypatch.setattr(lobby_module, "_can_run_scenario", no_access)
    mgr = lobby_module.CurrentLobbyManager(str(uuid.uuid4()))
    assert await mgr.select_lobby_scenario(uuid.uuid4(), _user()) is False
    assert doc == {"launched_scenario_id": "keep"}


@pytest.mark.asyncio
async def test_launched_copy_is_not_picked_as_prep(monkeypatch):
    _use(monkeypatch, {}, _FakeDb(SimpleNamespace(is_session_snapshot=True)))
    mgr = lobby_module.CurrentLobbyManager(str(uuid.uuid4()))
    assert await mgr.select_lobby_scenario(uuid.uuid4(), _user()) is False


@pytest.mark.asyncio
async def test_missing_scenario_is_rejected_not_crashing(monkeypatch):
    _use(monkeypatch, {}, _FakeDb(None))
    mgr = lobby_module.CurrentLobbyManager(str(uuid.uuid4()))
    assert await mgr.select_lobby_scenario(uuid.uuid4(), _user()) is False


@pytest.mark.asyncio
async def test_party_of_other_launched_scenario_is_rejected(monkeypatch):
    launched = uuid.uuid4()
    party_id = uuid.uuid4()
    doc = {"launched_scenario_id": str(launched), "party_id": None}
    foreign = SimpleNamespace(launched_scenario_id=uuid.uuid4())
    _use(monkeypatch, doc, _FakeDb(objects={party_id: foreign}))
    mgr = lobby_module.CurrentLobbyManager(str(uuid.uuid4()))
    assert await mgr.select_lobby_party(party_id) is False
    assert doc["party_id"] is None

    foreign.launched_scenario_id = launched
    assert await mgr.select_lobby_party(party_id) is True
    assert doc["party_id"] == str(party_id)


@pytest.mark.asyncio
async def test_foreign_campaign_is_rejected(monkeypatch):
    from app.services import campaign_service

    campaign = SimpleNamespace(master_id=uuid.uuid4(), scenario_links=[object()])

    async def fake_load(db, campaign_id):
        return campaign

    monkeypatch.setattr(campaign_service, "_load_campaign", fake_load)
    _use(monkeypatch, {}, _FakeDb())
    mgr = lobby_module.CurrentLobbyManager(str(uuid.uuid4()))
    assert await mgr.select_lobby_campaign(uuid.uuid4(), _user()) is False
