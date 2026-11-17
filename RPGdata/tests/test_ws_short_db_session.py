"""Сокеты не держат сессию БД всё подключение и не пишут cookie в лог."""

from __future__ import annotations

import inspect
import uuid
from types import SimpleNamespace

import pytest

import app.main  # noqa: F401  (resolves circular imports)
from app.auth import user as auth_user


def test_websocket_endpoints_take_no_request_scoped_db(websocket_routes):
    for route in websocket_routes:
        params = inspect.signature(route.endpoint).parameters
        assert "db" not in params, f"{route.path} держит сессию БД на всё подключение"


@pytest.mark.asyncio
async def test_ws_auth_closes_its_session_and_does_not_log_cookies(monkeypatch):
    user_id = uuid.uuid4()
    state = {"closed": False}
    logged: list[str] = []

    class _Db:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            state["closed"] = True
            return False

        async def execute(self, _stmt):
            found = SimpleNamespace(id=user_id)
            return SimpleNamespace(scalars=lambda: SimpleNamespace(first=lambda: found))

    monkeypatch.setattr(auth_user, "AsyncSessionLocal", lambda: _Db())
    monkeypatch.setattr(auth_user, "verify_jwt", lambda _t: SimpleNamespace(user_id=user_id))
    monkeypatch.setattr(auth_user.logger, "info", lambda msg, *a: logged.append(str(msg)))

    ws = SimpleNamespace(cookies={"access_token": "secret-token"})
    found = await auth_user.get_current_user_ws(ws)

    assert found.id == user_id
    assert state["closed"] is True
    assert not any("secret-token" in line for line in logged)
