"""Closed approaches must leave «Активные подходы» and unblock launched worlds."""

from __future__ import annotations

import importlib
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest


def _module(name: str):
    importlib.import_module("app.main")
    return importlib.import_module(name)


def _runtime(svc_mod, *, approach_id, launched_id):
    scheme = importlib.import_module("app.scheme")
    SessionRuntimeState = importlib.import_module("app.scheme.session.runtime").SessionRuntimeState
    return SessionRuntimeState(
        id=approach_id,
        scenario_id=launched_id,
        rule_id_str="test",
        name="t",
        master=scheme.User(id=uuid.uuid4()),
        launched_scenario_id=launched_id,
        approach_session_id=approach_id,
    )


@pytest.mark.asyncio
async def test_release_approach_runtime_clears_binding(monkeypatch):
    svc = _module("app.services.launched_scenario_service")
    approach_id = uuid.uuid4()
    launched_id = uuid.uuid4()
    runtime = _runtime(svc, approach_id=approach_id, launched_id=launched_id)
    stored = {"value": runtime.model_dump(mode="json")}

    json_api = MagicMock()
    json_api.get = AsyncMock(return_value=stored["value"])

    async def _set(key, path, payload):
        stored["value"] = payload

    json_api.set = AsyncMock(side_effect=_set)
    redis = MagicMock()
    redis.json = MagicMock(return_value=json_api)
    monkeypatch.setattr(svc, "redis_client", redis)

    await svc.release_approach_runtime(launched_id, approach_id)

    assert stored["value"]["approach_session_id"] is None
    assert stored["value"]["players"] == []


@pytest.mark.asyncio
async def test_release_approach_runtime_ignores_other_approach(monkeypatch):
    svc = _module("app.services.launched_scenario_service")
    other_id = uuid.uuid4()
    launched_id = uuid.uuid4()
    runtime = _runtime(svc, approach_id=other_id, launched_id=launched_id)
    payload = runtime.model_dump(mode="json")

    json_api = MagicMock()
    json_api.get = AsyncMock(return_value=payload)
    json_api.set = AsyncMock()
    redis = MagicMock()
    redis.json = MagicMock(return_value=json_api)
    monkeypatch.setattr(svc, "redis_client", redis)

    await svc.release_approach_runtime(launched_id, uuid.uuid4())

    json_api.set.assert_not_called()


@pytest.mark.asyncio
async def test_get_active_heals_stale_db_when_redis_cleared(monkeypatch):
    svc = _module("app.services.launched_scenario_service")
    models = importlib.import_module("app.models")
    launched_id = uuid.uuid4()
    stale_id = uuid.uuid4()
    stale = SimpleNamespace(
        id=stale_id,
        is_active=True,
        status=models.GameSessionStatus.active,
        finished_at=None,
    )

    class _Result:
        def scalars(self):
            return self

        def all(self):
            return [stale]

    db = AsyncMock()
    db.execute = AsyncMock(return_value=_Result())
    db.commit = AsyncMock()

    cleared = _runtime(svc, approach_id=stale_id, launched_id=launched_id)
    cleared.approach_session_id = None
    json_api = MagicMock()
    json_api.get = AsyncMock(return_value=cleared.model_dump(mode="json"))
    redis = MagicMock()
    redis.json = MagicMock(return_value=json_api)
    monkeypatch.setattr(svc, "redis_client", redis)

    live = await svc.get_active_approach_session_id(db, launched_id)

    assert live is None
    assert stale.is_active is False
    assert stale.status == models.GameSessionStatus.finished_forced
    assert isinstance(stale.finished_at, datetime)
    assert stale.finished_at.tzinfo == timezone.utc
    db.commit.assert_awaited_once()
