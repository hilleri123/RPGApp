"""Regression tests for wave 2: privilege escalation and scenario-level access.

Covers the self-update mass assignment hole (any user could set is_admin),
the /users list 404 under redirect_slashes=False, missing scenario checks on
/entities, /scenarios/full and the icon upload, and the tightened access-group
endpoints.
"""

from __future__ import annotations

import importlib
import uuid
from types import SimpleNamespace

import pytest
from fastapi import HTTPException


def _app():
    """Import the FastAPI app lazily — see the note in test_wave1_security."""
    return importlib.import_module("app.main").app


def _module(name: str):
    importlib.import_module("app.main")
    return importlib.import_module(name)


def _routes():
    return [r for r in _app().routes if hasattr(r, "path") and hasattr(r, "methods")]


def _route(path: str, method: str):
    found = [r for r in _routes() if r.path == path and method in (r.methods or set())]
    assert len(found) == 1, f"{method} {path}: найдено {len(found)}"
    return found[0]


def _dependency_calls(route):
    return [d.call for d in route.dependant.dependencies]


async def _coro(value):
    return value


class _FakeResult:
    def __init__(self, row):
        self._row = row

    def scalars(self):
        return self

    def first(self):
        return self._row


class _FakeDB:
    """Returns one fixed row for any query. Commit is recorded, not performed."""

    def __init__(self, row=None):
        self.row = row
        self.committed = False
        self.deleted = []

    async def execute(self, stmt):
        return _FakeResult(self.row)

    async def get(self, model, pk):
        return self.row

    async def commit(self):
        self.committed = True

    async def refresh(self, obj, *args, **kwargs):
        return None

    async def delete(self, obj):
        self.deleted.append(obj)


# --- Присвоение ролей самому себе ------------------------------------------


def test_self_update_schema_has_no_privileged_fields():
    """UserUpdate наследует is_admin и can_be_master, поэтому у правки
    собственного профиля должна быть отдельная схема."""
    from app import scheme

    fields = set(scheme.UserSelfUpdate.model_fields)
    assert not fields & {"id", "is_admin", "can_be_master", "is_active"}
    assert "full_name" in fields and "new_password" in fields


def test_update_me_uses_self_update_schema():
    route = _route("/users/me", "PUT")
    from app import scheme

    body_field = route.dependant.body_params[0]
    assert body_field.type_ is scheme.UserSelfUpdate


@pytest.mark.asyncio
async def test_update_me_ignores_role_fields_sent_by_client():
    from app import scheme

    router = _module("app.routes.user.router")
    user = SimpleNamespace(
        id=uuid.uuid4(),
        full_name="Было",
        email="a@b.c",
        is_admin=False,
        can_be_master=False,
        is_active=True,
        telegram_id=None,
        icon_url=None,
        img_url=None,
        hashed_password=None,
    )
    db = _FakeDB()

    # Клиент присылает лишние поля — pydantic их отбрасывает, до setattr они не доходят.
    patch = scheme.UserSelfUpdate.model_validate(
        {"full_name": "Стало", "is_admin": True, "can_be_master": True}
    )
    await router.update_me(user_patch=patch, current_user=user, db=db)

    assert user.full_name == "Стало"
    assert user.is_admin is False
    assert user.can_be_master is False


# --- Админская правка пользователя ----------------------------------------


def test_admin_update_user_requires_admin():
    from app.auth.role import require_admin

    assert require_admin in _dependency_calls(_route("/users/{user_id}", "PATCH"))


@pytest.mark.asyncio
async def test_admin_can_grant_master_rights():
    from app import scheme

    router = _module("app.routes.user.router")
    target = SimpleNamespace(id=uuid.uuid4(), can_be_master=False, is_admin=False)
    admin = SimpleNamespace(id=uuid.uuid4(), is_admin=True)

    await router.admin_update_user(
        user_id=target.id,
        user_patch=scheme.UserUpdate.model_validate({"can_be_master": True}),
        current_user=admin,
        db=_FakeDB(row=target),
    )

    assert target.can_be_master is True


@pytest.mark.asyncio
async def test_admin_cannot_demote_self():
    from app import scheme

    router = _module("app.routes.user.router")
    admin = SimpleNamespace(id=uuid.uuid4(), is_admin=True, can_be_master=True)

    with pytest.raises(HTTPException) as exc:
        await router.admin_update_user(
            user_id=admin.id,
            user_patch=scheme.UserUpdate.model_validate({"is_admin": False}),
            current_user=admin,
            db=_FakeDB(row=admin),
        )

    assert exc.value.status_code == 400
    assert admin.is_admin is True


# --- Список пользователей и redirect_slashes ------------------------------


def test_users_list_answers_without_trailing_slash():
    """Приложение поднято с redirect_slashes=False: путь без слеша давал 404,
    из-за чего страница групп доступа показывала «Not Found»."""
    paths = {r.path for r in _routes() if "GET" in (r.methods or set())}
    assert "/users" in paths and "/users/" in paths


def test_no_collection_route_is_registered_only_with_slash():
    """Ловим ту же мину в остальных роутерах."""
    get_paths = {r.path for r in _routes() if "GET" in (r.methods or set())}
    only_slash = sorted(
        p for p in get_paths
        if p.endswith("/") and len(p) > 1 and p[:-1] not in get_paths
    )
    assert only_slash == []


# --- Доступ к сценарию на универсальных роутах ----------------------------


@pytest.mark.asyncio
async def test_entities_routes_check_scenario_access(monkeypatch):
    entities = _module("app.routes.scenarios.entities")

    calls = []

    async def _deny(db, user, scenario_id, min_permission="read"):
        calls.append((scenario_id, min_permission))
        raise HTTPException(status_code=403, detail="Нет доступа")

    monkeypatch.setattr(entities, "require_scenario_by_id", _deny)

    scenario_id = uuid.uuid4()
    user = SimpleNamespace(id=uuid.uuid4())
    entity = SimpleNamespace(id=uuid.uuid4(), scenario_id=scenario_id, data={}, tags=[])

    with pytest.raises(HTTPException) as exc:
        await entities.list_entities(
            type="npc", scenario_id=scenario_id, skip=0, limit=10,
            current_user=user, db=_FakeDB(),
        )
    assert exc.value.status_code == 403

    with pytest.raises(HTTPException) as exc:
        await entities.get_entity(
            entity_id=entity.id, type="npc", current_user=user, db=_FakeDB(row=entity),
        )
    assert exc.value.status_code == 403

    with pytest.raises(HTTPException) as exc:
        await entities.delete_entity(
            entity_id=entity.id, type="npc", current_user=user, db=_FakeDB(row=entity),
        )
    assert exc.value.status_code == 403

    assert len(calls) == 3
    # Чтение допускает read, удаление требует правки сущностей.
    assert calls[0][1] == "read"
    assert calls[2][1] == "edit_partial"


@pytest.mark.asyncio
async def test_scenario_full_checks_access(monkeypatch):
    full = _module("app.routes.scenarios.full")
    scenario = SimpleNamespace(id=uuid.uuid4(), is_session_snapshot=False)

    async def _deny(db, user, scen, min_permission="read"):
        raise HTTPException(status_code=403, detail="Нет доступа")

    monkeypatch.setattr(full, "require_scenario_access", _deny)

    with pytest.raises(HTTPException) as exc:
        await full.read_scenario(
            scenario_id=scenario.id,
            current_user=SimpleNamespace(id=uuid.uuid4()),
            db=_FakeDB(row=scenario),
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_scenario_icon_upload_requires_meta_edit(monkeypatch):
    routes = _module("app.routes.scenarios.routes")
    scenario = SimpleNamespace(id=uuid.uuid4(), icon=None)

    monkeypatch.setattr(routes, "get_scenario_permission", lambda db, u, s: _coro("read"))

    with pytest.raises(HTTPException) as exc:
        await routes.add_icon(
            scenario_id=scenario.id,
            icon=SimpleNamespace(filename="a.png"),
            current_user=SimpleNamespace(id=uuid.uuid4()),
            db=_FakeDB(row=scenario),
        )
    assert exc.value.status_code == 403
    assert scenario.icon is None


# --- Группы доступа --------------------------------------------------------


def test_rule_access_routes_are_gone():
    """Роуты опирались на модель MasterGroupRuleAccess, которой нет ни в
    app/models, ни в базе — любой вызов падал."""
    offenders = [r.path for r in _routes() if "/access_groups/rules" in r.path]
    assert offenders == []


def test_rule_object_type_is_not_supported():
    permissions = _module("app.auth.permissions")
    assert "MasterGroupRuleAccess" not in permissions.__dict__


@pytest.mark.asyncio
async def test_admin_counts_as_master():
    """Иначе администратор без флага мастера не может открыть даже список групп."""
    from app.auth.role import require_master

    admin = SimpleNamespace(id=uuid.uuid4(), can_be_master=False, is_admin=True)
    assert await require_master(user=admin) is admin

    plain = SimpleNamespace(id=uuid.uuid4(), can_be_master=False, is_admin=False)
    with pytest.raises(HTTPException) as exc:
        await require_master(user=plain)
    assert exc.value.status_code == 403


def test_group_listing_requires_master_and_details_require_admin():
    from app.auth.role import require_admin, require_master

    assert require_master in _dependency_calls(_route("/access_groups", "GET"))
    assert require_admin in _dependency_calls(_route("/access_groups/{group_id}", "GET"))
    assert require_admin in _dependency_calls(
        _route("/access_groups/{group_id}/scenarios", "GET")
    )


@pytest.mark.asyncio
async def test_only_full_rights_may_share_a_scenario(monkeypatch):
    access = _module("app.routes.access_groups.access")
    scenario = SimpleNamespace(id=uuid.uuid4(), name="Сценарий")
    user = SimpleNamespace(id=uuid.uuid4(), is_admin=False)

    monkeypatch.setattr(access, "get_scenario_permission", lambda db, u, s: _coro("edit_full"))
    with pytest.raises(HTTPException) as exc:
        await access._scenario_for_sharing(_FakeDB(row=scenario), user, scenario.id)
    assert exc.value.status_code == 403

    monkeypatch.setattr(access, "get_scenario_permission", lambda db, u, s: _coro("all"))
    got = await access._scenario_for_sharing(_FakeDB(row=scenario), user, scenario.id)
    assert got is scenario


@pytest.mark.asyncio
async def test_sharing_rejects_unknown_permission(monkeypatch):
    from app import scheme

    access = _module("app.routes.access_groups.access")
    scenario = SimpleNamespace(id=uuid.uuid4(), name="Сценарий")
    monkeypatch.setattr(access, "get_scenario_permission", lambda db, u, s: _coro("all"))

    payload = scheme.MasterGroupScenarioAccess.model_construct(
        master_group_id=uuid.uuid4(), scenario_id=scenario.id, permission="owner",
    )

    with pytest.raises(HTTPException) as exc:
        await access.set_scenario_group_access(
            scenario_id=scenario.id,
            data=payload,
            db=_FakeDB(row=scenario),
            current_user=SimpleNamespace(id=uuid.uuid4(), is_admin=False),
        )
    assert exc.value.status_code == 400


# --- Session snapshot: player read access ---------------------------------


@pytest.mark.asyncio
async def test_session_snapshot_player_gets_read_access(monkeypatch):
    """Игрок в активной сессии должен читать schema/options своего персонажа."""
    access = _module("app.routes.scenarios.access")
    scenario = SimpleNamespace(
        id=uuid.uuid4(),
        is_session_snapshot=True,
        source_scenario_id=None,
    )
    user = SimpleNamespace(id=uuid.uuid4())
    session = SimpleNamespace(id=uuid.uuid4())

    monkeypatch.setattr(access, "get_scenario_permission", lambda db, u, s: _coro("none"))

    async def _sessions(db, *, scenario_id, user_id, as_master):
        if as_master:
            return None
        assert scenario_id == scenario.id
        assert user_id == user.id
        return session

    monkeypatch.setattr(access, "_active_session_for_user", _sessions)

    perm = await access.require_scenario_access(_FakeDB(), user, scenario, "read")
    assert perm == "read"


@pytest.mark.asyncio
async def test_session_snapshot_player_cannot_edit(monkeypatch):
    access = _module("app.routes.scenarios.access")
    scenario = SimpleNamespace(
        id=uuid.uuid4(),
        is_session_snapshot=True,
        source_scenario_id=None,
    )
    user = SimpleNamespace(id=uuid.uuid4())

    monkeypatch.setattr(access, "get_scenario_permission", lambda db, u, s: _coro("none"))

    async def _sessions(db, *, scenario_id, user_id, as_master):
        return None if as_master else SimpleNamespace(id=uuid.uuid4())

    monkeypatch.setattr(access, "_active_session_for_user", _sessions)

    with pytest.raises(HTTPException) as exc:
        await access.require_scenario_access(_FakeDB(), user, scenario, "edit_partial")
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_session_snapshot_outsider_denied(monkeypatch):
    access = _module("app.routes.scenarios.access")
    scenario = SimpleNamespace(
        id=uuid.uuid4(),
        is_session_snapshot=True,
        source_scenario_id=None,
    )
    user = SimpleNamespace(id=uuid.uuid4())

    monkeypatch.setattr(access, "get_scenario_permission", lambda db, u, s: _coro("none"))

    async def _sessions(db, *, scenario_id, user_id, as_master):
        return None

    monkeypatch.setattr(access, "_active_session_for_user", _sessions)

    with pytest.raises(HTTPException) as exc:
        await access.require_scenario_access(_FakeDB(), user, scenario, "read")
    assert exc.value.status_code == 403
