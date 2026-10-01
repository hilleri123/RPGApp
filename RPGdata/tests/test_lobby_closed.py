"""Закрытые лобби: создание, приглашения, видимость, присутствие, Telegram-событие."""

from __future__ import annotations

import asyncio
import copy
import importlib
import inspect
import uuid

from app import models, scheme
from app.scheme.lobby import ActionBase


class _FakeJson:
    def __init__(self, store: dict):
        self.store = store

    @staticmethod
    def _parts(path) -> list[str]:
        raw = str(path)
        return [p for p in raw.strip(".$").split(".") if p]

    def get(self, key, path="."):
        if key not in self.store:
            return None
        node = self.store[key]
        for part in self._parts(path):
            if not isinstance(node, dict) or part not in node:
                return None
            node = node[part]
        return copy.deepcopy(node)

    def set(self, key, path, value):
        parts = self._parts(path)
        if not parts:
            self.store[key] = copy.deepcopy(value)
            return True
        node = self.store[key]
        for part in parts[:-1]:
            node = node[part]
        node[parts[-1]] = copy.deepcopy(value)
        return True

    def delete(self, key, path="."):
        self.store.pop(key, None)


class _FakeRedis:
    def __init__(self):
        self.store: dict = {}

    def json(self):
        return _FakeJson(self.store)

    def exists(self, key):
        return int(key in self.store)


class _AsyncFakeRedis:
    """redis.asyncio-совместимая обёртка: методы — корутины."""

    def __init__(self):
        self._sync = _FakeRedis()

    def json(self):
        sync_json = self._sync.json()

        class _J:
            async def get(self, key, path="."):
                return sync_json.get(key, path)

            async def set(self, key, path, value):
                return sync_json.set(key, path, value)

            async def delete(self, key, path="."):
                return sync_json.delete(key, path)

            async def arrappend(self, key, path, value):
                items = sync_json.get(key, path) or []
                items.append(value)
                return sync_json.set(key, path, items)

        return _J()

    async def exists(self, key):
        return self._sync.exists(key)

    async def scan_iter(self, pattern):  # pragma: no cover - вызывается как async for
        for key in list(self._sync.store):
            yield key


def _lm(monkeypatch):
    importlib.import_module("app.main")
    mod = importlib.import_module("app.managers.lobby_manager")
    fake = _AsyncFakeRedis()
    monkeypatch.setattr(mod, "redis_client", fake)
    return mod, fake


def _user(name: str, *, telegram_id: int | None = None) -> models.User:
    return models.User(
        id=uuid.uuid4(),
        email=f"{name}@example.com",
        full_name=name,
        is_admin=False,
        can_be_master=True,
        is_active=True,
        telegram_id=telegram_id,
    )


def _create(mod, master, **extra):
    return asyncio.run(
        mod.manager.create_lobby(scheme.LobbyCreate(name="L", max_players=4, **extra), master)
    )


def test_lobby_is_created_closed_even_if_client_asks_to_open(monkeypatch):
    mod, _ = _lm(monkeypatch)
    master = _user("gm")
    lobby = _create(mod, master, is_open=True)
    assert lobby.is_open is False
    assert lobby.invited_users == []


def test_client_cannot_preset_invites_or_presence(monkeypatch):
    mod, _ = _lm(monkeypatch)
    stranger = _user("stranger")
    hit = scheme.User.model_validate(stranger).model_dump(mode="json")
    lobby = _create(
        mod, _user("gm"), invited_users=[hit], online_user_ids=[stranger.id], banned_user_ids=[]
    )
    assert lobby.invited_users == []
    assert lobby.online_user_ids == []


def test_invite_does_not_mark_user_as_connected(monkeypatch):
    mod, _ = _lm(monkeypatch)
    lobby = _create(mod, _user("gm"))
    guest = _user("guest")
    lm = mod.manager[str(lobby.id)]

    assert asyncio.run(lm.invite_user(guest)) is True
    assert asyncio.run(lm.invite_user(guest)) is False  # повтор не шлёт второе приглашение

    fresh = asyncio.run(lm.get_lobby())
    assert [u.id for u in fresh.invited_users] == [guest.id]
    # Присутствие — только по живым сокетам, а не по факту приглашения.
    assert fresh.users == []
    assert asyncio.run(lm.is_invited(guest)) is True


def test_open_toggle(monkeypatch):
    mod, _ = _lm(monkeypatch)
    lobby = _create(mod, _user("gm"))
    lm = mod.manager[str(lobby.id)]
    assert asyncio.run(lm.is_open()) is False
    assert asyncio.run(lm.set_open(True)) is True
    assert asyncio.run(lm.is_open()) is True
    assert asyncio.run(lm.set_open(False)) is True
    assert asyncio.run(lm.is_open()) is False


def test_legacy_lobby_without_new_fields_is_closed_and_inviteable(monkeypatch):
    mod, fake = _lm(monkeypatch)
    lobby = _create(mod, _user("gm"))
    key = f"lobby:{lobby.id}"
    doc = fake._sync.store[key]
    for f in ("is_open", "invited_users", "online_user_ids"):
        doc.pop(f, None)
    lm = mod.manager[str(lobby.id)]

    assert asyncio.run(lm.is_open()) is False
    guest = _user("guest")
    assert asyncio.run(lm.is_invited(guest)) is False
    assert asyncio.run(lm.invite_user(guest)) is True


def test_invite_lifts_ban_and_uninvite_removes(monkeypatch):
    mod, _ = _lm(monkeypatch)
    lobby = _create(mod, _user("gm"))
    lm = mod.manager[str(lobby.id)]
    guest = _user("guest")

    asyncio.run(lm._ban_user_id(guest.id))
    assert asyncio.run(lm.is_banned(guest)) is True

    asyncio.run(lm.invite_user(guest))
    assert asyncio.run(lm.is_banned(guest)) is False

    assert asyncio.run(lm.uninvite_user(guest.id)) is True
    assert asyncio.run(lm.is_invited(guest)) is False
    assert asyncio.run(lm.uninvite_user(guest.id)) is False


def test_uninvite_drops_waiting_user(monkeypatch):
    mod, _ = _lm(monkeypatch)
    lobby = _create(mod, _user("gm"))
    lm = mod.manager[str(lobby.id)]
    guest = _user("guest")
    asyncio.run(lm.invite_user(guest))
    asyncio.run(lm.add_to_lobby(guest))

    assert asyncio.run(lm.uninvite_user(guest.id)) is True
    fresh = asyncio.run(lm.get_lobby())
    assert fresh.users == [] and fresh.invited_users == []


def test_catalogue_hides_closed_lobby_from_strangers(monkeypatch):
    mod, _ = _lm(monkeypatch)
    master = _user("gm")
    lobby = _create(mod, master)
    lm = mod.manager[str(lobby.id)]
    guest = _user("guest")
    stranger = _user("stranger")

    def ids(viewer):
        return [p.id for p in asyncio.run(mod.manager.list_lobbies(viewer.id))]

    assert ids(master) == [lobby.id]
    assert ids(stranger) == []
    assert ids(guest) == []

    asyncio.run(lm.invite_user(guest))
    assert ids(guest) == [lobby.id]
    assert ids(stranger) == []
    preview = asyncio.run(mod.manager.list_lobbies(guest.id))[0]
    assert preview.is_invited is True and preview.is_open is False

    asyncio.run(lm.set_open(True))
    assert ids(stranger) == [lobby.id]


def test_catalogue_without_viewer_shows_only_open(monkeypatch):
    mod, _ = _lm(monkeypatch)
    lobby = _create(mod, _user("gm"))
    assert asyncio.run(mod.manager.list_lobbies(None)) == []
    asyncio.run(mod.manager[str(lobby.id)].set_open(True))
    assert len(asyncio.run(mod.manager.list_lobbies(None))) == 1


class _FakeConnections:
    def __init__(self, online: set):
        self.online = online

    def is_online(self, user_id) -> bool:
        return user_id in self.online


def test_online_ids_follow_live_sockets_not_membership(monkeypatch):
    mod, _ = _lm(monkeypatch)
    importlib.import_module("app.main")
    ws = importlib.import_module("app.routes.websocket.lobby")
    master = _user("gm")
    lobby = _create(mod, master)
    lm = mod.manager[str(lobby.id)]
    away, here = _user("away"), _user("here")
    asyncio.run(lm.invite_user(away))
    asyncio.run(lm.invite_user(here))

    snapshot = asyncio.run(lm.get_lobby())
    online = ws.online_user_ids(snapshot, _FakeConnections({master.id, here.id}))
    assert set(online) == {master.id, here.id}
    assert away.id not in online

    payload = asyncio.run(ws.lobby_payload(lm, _FakeConnections({here.id})))
    assert payload["online_user_ids"] == [str(here.id)]


def test_master_actions_parse():
    uid = str(uuid.uuid4())
    a = ActionBase.parse_action({"user_role": "master", "msg_type": "set_lobby_open", "is_open": True})
    assert isinstance(a, scheme.MasterSetLobbyOpen) and a.is_open is True
    b = ActionBase.parse_action({"user_role": "master", "msg_type": "invite_user", "invite_user_id": uid})
    assert isinstance(b, scheme.MasterInviteUser) and str(b.invite_user_id) == uid
    c = ActionBase.parse_action({"user_role": "master", "msg_type": "uninvite_user", "invite_user_id": uid})
    assert isinstance(c, scheme.MasterUninviteUser)
    # Игрок не может присылать мастерские действия как «player».
    try:
        ActionBase.parse_action({"user_role": "player", "msg_type": "invite_user", "invite_user_id": uid})
    except ValueError:
        pass
    else:  # pragma: no cover
        raise AssertionError("player must not be able to invite")


def test_websocket_gate_runs_before_auto_add():
    importlib.import_module("app.main")
    ws = importlib.import_module("app.routes.websocket.lobby")
    src = inspect.getsource(ws.websocket_endpoint)
    assert "is_invited" in src and "is_open" in src
    assert src.index("is_invited") < src.index("add_to_lobby")
    # Закрытая вкладка при открытой второй не должна выкидывать из списка.
    assert "is_online(current_user.id)" in src


def test_user_search_is_master_only_and_skips_email():
    importlib.import_module("app.main")
    ws = importlib.import_module("app.routes.websocket.lobby")
    src = inspect.getsource(ws.search_users_to_invite)
    assert "is_master" in src
    assert "models.User.email" not in src
    assert set(scheme.LobbyUserHit.model_fields) == {"id", "full_name", "tg", "icon_url", "has_telegram"}


def test_lobby_invited_event_carries_lobby_path():
    from app.services import bot_notify_service as svc

    lid = uuid.uuid4()
    ev = svc.build_lobby_invited_event(
        telegram_id=7, lobby_id=lid, lobby_name="L", master_name="GM"
    )
    assert ev["event"] == "lobby_invited"
    assert ev["telegram_id"] == 7
    assert ev["lobby_id"] == str(lid)
    assert ev["next_path"] == f"/lobby/{lid}"


def test_notify_lobby_invited_publishes_only_for_linked_users(monkeypatch):
    from app.services import bot_notify_service as svc

    published = []

    async def fake_ids(user_ids):
        return [101, 202]

    async def fake_publish(event):
        published.append(event)

    monkeypatch.setattr(svc, "_telegram_ids", fake_ids)
    rabbit = importlib.import_module("app.infrastructure.rabbitmq")
    monkeypatch.setattr(rabbit, "publish_bot_event", fake_publish)

    lid = uuid.uuid4()
    sent = asyncio.run(
        svc.notify_lobby_invited(
            lobby_id=lid, user_ids=[uuid.uuid4(), uuid.uuid4()], lobby_name="L", master_name="GM"
        )
    )
    assert sent == 2
    assert [e["telegram_id"] for e in published] == [101, 202]
    assert all(e["event"] == "lobby_invited" for e in published)


def test_notify_lobby_invited_never_raises(monkeypatch):
    from app.services import bot_notify_service as svc

    async def boom(user_ids):
        raise RuntimeError("db down")

    monkeypatch.setattr(svc, "_telegram_ids", boom)
    assert asyncio.run(
        svc.notify_lobby_invited(lobby_id=uuid.uuid4(), user_ids=[uuid.uuid4()], lobby_name="L")
    ) == 0
