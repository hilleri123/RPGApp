"""Сокеты разделены по комнатам: рассылка одного лобби/сессии не уходит в другое."""

from __future__ import annotations

import uuid

import pytest
from starlette.websockets import WebSocketState

import app.main  # noqa: F401  (resolves circular imports)
from app.managers.connection_manager import (
    lobby_sockets,
    lobby_tag,
    manager,
    session_sockets,
    session_tag,
)
from app.services.change_scheduler import ChangeScheduler


class _FakeSocket:
    client_state = WebSocketState.CONNECTED

    def __init__(self) -> None:
        self.sent: list[dict] = []

    async def send_json(self, data):
        self.sent.append(data)

    async def close(self, code: int = 1000):
        self.client_state = WebSocketState.DISCONNECTED


@pytest.mark.asyncio
async def test_lobby_broadcast_stays_in_its_lobby():
    user = uuid.uuid4()
    lobby_a, lobby_b = str(uuid.uuid4()), str(uuid.uuid4())
    ws_a, ws_b = _FakeSocket(), _FakeSocket()
    await lobby_sockets(lobby_a).connect(user, ws_a)
    await lobby_sockets(lobby_b).connect(user, ws_b)
    try:
        await lobby_sockets(lobby_a).send_json(user, {"msg_type": "lobby_closed"})
        assert ws_a.sent == [{"msg_type": "lobby_closed"}]
        assert ws_b.sent == []
    finally:
        await lobby_sockets(lobby_a).disconnect(user, ws_a)
        await lobby_sockets(lobby_b).disconnect(user, ws_b)
        manager.release(lobby_tag(lobby_a))
        manager.release(lobby_tag(lobby_b))


@pytest.mark.asyncio
async def test_session_room_key_ignores_id_spelling_and_releases():
    sid = uuid.uuid4()
    user = uuid.uuid4()
    ws = _FakeSocket()
    await session_sockets(str(sid).upper()).connect(user, ws)
    assert session_sockets(sid).is_online(user)

    await session_sockets(sid).disconnect(user, ws)
    manager.release(session_tag(sid))
    assert session_tag(sid) not in manager.managers


def test_second_tab_keeps_earlier_cursor():
    sched = ChangeScheduler()
    sid, uid = uuid.uuid4(), uuid.uuid4()
    sched.watch(sid, uid, "player", 10)
    sched.watch(sid, uid, "player", 25)
    assert sched.watches[(sid, uid)].cursor == 10
