"""gone из чужой зоны не доходит до того, у кого объект остался; «показывать всем» видно в зоне."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

import app.main  # noqa: F401  (resolves circular imports)
import app.managers as managers_pkg
from app.services import change_scheduler as scheduler_mod
from app.services import visibility_service
from app.services.visibility_service import wanted_ids


class _FakeDb:
    def __init__(self, rows):
        self._rows = rows

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def execute(self, _stmt):
        rows = self._rows
        return SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: rows))


class _Sockets:
    def __init__(self):
        self.sent: dict = {}

    async def send_json(self, user_id, payload):
        self.sent.setdefault(user_id, []).extend(payload["changes"])


@pytest.mark.asyncio
async def test_gone_skips_users_who_still_see_the_object(monkeypatch):
    session_id, master_id, player_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    npc_id = uuid.uuid4()
    row = SimpleNamespace(
        id=10, object_type="npc", object_id=npc_id, version=0, op="gone",
        session_id=session_id, changed_at=datetime.now(timezone.utc),
    )
    zones = {master_id: {("npc", npc_id)}, player_id: set()}
    sockets = _Sockets()

    async def load_visible_keys(_sid, uid):
        return zones[uid]

    async def rebuild_for_user(*_a, **_k):
        return None

    monkeypatch.setattr(scheduler_mod, "AsyncSessionLocal", lambda: _FakeDb([row]))
    monkeypatch.setattr(visibility_service, "load_visible_keys", load_visible_keys)
    monkeypatch.setattr(visibility_service, "rebuild_for_user", rebuild_for_user)
    monkeypatch.setattr(managers_pkg, "master_connection_manager", {"session": sockets})
    monkeypatch.setattr(managers_pkg.session_manager, "managers", {})

    sched = scheduler_mod.ChangeScheduler()
    sched.watch(session_id, master_id, "master", 0)
    sched.watch(session_id, player_id, "player", 0)
    await sched.tick()

    # НПС ушёл из зоны игрока, мастер его по-прежнему видит.
    assert master_id not in sockets.sent
    assert [c["object_id"] for c in sockets.sent[player_id]] == [str(npc_id)]


def _inner(action, *, show_everyone: bool):
    return SimpleNamespace(
        characters=[], npcs=[], items=[], scenes=[], logs=[], audio_queue=[], notes=[],
        actions=[action],
        settings={"show_action_to_everyone": show_everyone, "audio_mode": "global"},
    )


@pytest.mark.parametrize(
    ("show_everyone", "tags", "visible"),
    [(True, [], True), (True, ["hidden"], False), (False, [], False)],
)
def test_show_action_to_everyone_puts_foreign_action_in_zone(show_everyone, tags, visible):
    me, other = uuid.uuid4(), uuid.uuid4()
    action = {"id": str(uuid.uuid4()), "participantIds": [str(other)], "tags": tags}
    wanted = wanted_ids(
        _inner(action, show_everyone=show_everyone), role="player", user_id=me, character_ids=set(),
    )
    assert (("action", uuid.UUID(action["id"])) in wanted) is visible


@pytest.mark.asyncio
async def test_settings_change_rebuilds_zones(monkeypatch):
    from app import scheme
    from app.managers.session import CurrentSessionManager
    from app.managers.session import settings_manager as settings_mod
    from app.services.change_scheduler import scheduler

    session_id = uuid.uuid4()
    manager = CurrentSessionManager(str(session_id))

    async def get_inner():
        return SimpleNamespace()

    async def is_master(_user):
        return True

    class _Json:
        async def set(self, *_a, **_k):
            return True

    monkeypatch.setattr(manager, "get_inner", get_inner)
    monkeypatch.setattr(manager, "is_master", is_master)
    monkeypatch.setattr(settings_mod, "redis_client", SimpleNamespace(json=lambda: _Json()))
    scheduler.dirty_sessions.discard(session_id)

    await manager.set_settings(SimpleNamespace(id=uuid.uuid4()), scheme.Settings(show_action_to_everyone=True))
    assert session_id in scheduler.dirty_sessions
    scheduler.dirty_sessions.discard(session_id)
