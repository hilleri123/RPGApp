"""Убранный игрок и конец сессии закрывают сокеты; тела отдаются только участникам."""

from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from starlette.websockets import WebSocketState

import app.main  # noqa: F401  (resolves circular imports)
from app.managers import master_connection_manager
from app.managers.connection_manager import session_sockets, session_tag
from app.routes.websocket import session as session_routes
from app.services.change_scheduler import scheduler


class _FakeSocket:
    def __init__(self) -> None:
        self.client_state = WebSocketState.CONNECTED
        self.sent: list[dict] = []

    async def send_json(self, data):
        self.sent.append(data)

    async def close(self, code: int = 1000):
        self.client_state = WebSocketState.DISCONNECTED


class _FakeManager:
    def __init__(self, *, master_id=None, player_ids=()) -> None:
        self.master_id = master_id
        self.player_ids = set(player_ids)

    async def session_exists(self):
        return True

    async def is_master(self, user):
        return user.id == self.master_id

    async def is_player(self, user):
        return user.id in self.player_ids

    async def finish_session(self, user, *, forced, close_launched_scenario):
        return True, None


def _patch_manager(monkeypatch, mgr):
    async def ensure(session_id):
        return mgr

    monkeypatch.setattr(session_routes.session_manager, "ensure_manager", ensure)


@pytest.mark.asyncio
async def test_objects_refused_to_non_member(monkeypatch):
    _patch_manager(monkeypatch, _FakeManager(master_id=uuid.uuid4()))
    with pytest.raises(HTTPException) as exc:
        await session_routes.get_session_objects(
            uuid.uuid4(), ids="npc:" + str(uuid.uuid4()), current_user=SimpleNamespace(id=uuid.uuid4())
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_finish_closes_player_sockets_but_not_master(monkeypatch):
    sid = uuid.uuid4()
    master, player = uuid.uuid4(), uuid.uuid4()
    _patch_manager(monkeypatch, _FakeManager(master_id=master, player_ids={player}))
    ws_master, ws_player = _FakeSocket(), _FakeSocket()
    sockets = session_sockets(sid)
    await sockets.connect(master, ws_master)
    await sockets.connect(player, ws_player)
    scheduler.watch(sid, player, "player", 0)
    try:
        await session_routes.finish_session(
            str(sid),
            session_routes.FinishSessionPayload(),
            current_user=SimpleNamespace(id=master),
        )
        assert ws_player.sent == [{"msg_type": "session_finished", "session_id": str(sid)}]
        assert ws_player.client_state == WebSocketState.DISCONNECTED
        assert (sid, player) not in scheduler.watches
        assert ws_master.sent == []
        assert sockets.is_online(master)
    finally:
        await sockets.disconnect(master)
        master_connection_manager.release(session_tag(sid))


@pytest.mark.asyncio
async def test_drop_from_session_tells_and_closes_only_that_session():
    sid, other_sid = uuid.uuid4(), uuid.uuid4()
    user = uuid.uuid4()
    here, there = _FakeSocket(), _FakeSocket()
    await session_sockets(sid).connect(user, here)
    await session_sockets(other_sid).connect(user, there)
    try:
        msg = session_routes._forbidden_message(sid, "kicked")
        await session_routes._drop_from_session(sid, user, msg)
        assert here.sent == [msg]
        assert here.client_state == WebSocketState.DISCONNECTED
        assert there.sent == []
        assert session_sockets(other_sid).is_online(user)
    finally:
        await session_sockets(other_sid).disconnect(user)
        master_connection_manager.release(session_tag(sid))
        master_connection_manager.release(session_tag(other_sid))
