"""Regression tests for wave 1 fixes: data integrity and access control.

Covers BE-01 (cross-scenario entity writes), BE-02 (removed broken route),
BE-03 (master-only session delete), BE-04 (admin-only plugin reload),
BE-05 (session list scoped to the user) and BE-14 (default secret key).
"""

from __future__ import annotations

import importlib
import uuid
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.infrastructure.settings import DEFAULT_SECRET_KEY, validate_secret_key


def _app():
    """Import the FastAPI app.

    Kept out of module scope on purpose: loading app.main also loads every
    rules plugin, and that global state leaks into unrelated tests (INF-09).
    Importing app.managers directly instead is not an option — it trips a
    circular import via app.routes.locations.
    """
    return importlib.import_module("app.main").app


def _module(name: str):
    importlib.import_module("app.main")
    return importlib.import_module(name)


# --- fakes -----------------------------------------------------------------


class _FakeResult:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return self

    def all(self):
        return list(self._rows)


class _FakeDB:
    """Records executed statements, returns a fixed row set."""

    def __init__(self, rows=()):
        self.rows = list(rows)
        self.statements = []
        self.committed = False

    async def execute(self, stmt):
        self.statements.append(stmt)
        return _FakeResult(self.rows)

    async def commit(self):
        self.committed = True

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


def _entity_row(entity_id: uuid.UUID):
    return SimpleNamespace(id=entity_id, data=None, tags=None)


async def _coro(value):
    return value


def _data_manager(monkeypatch, db):
    """A SessionDataManager wired to the fake db and a fixed scenario."""
    module = _module("app.managers.session.data_manager")
    monkeypatch.setattr(module, "AsyncSessionLocal", lambda: db)
    return module.SessionDataManager(str(uuid.uuid4()))


# --- BE-01: cross-scenario entity writes -----------------------------------


@pytest.mark.asyncio
async def test_persist_filters_by_scenario_id(monkeypatch):
    """The SELECT must be scoped to the session's scenario, not by id alone."""
    scenario_id = uuid.uuid4()
    own_id = uuid.uuid4()

    db = _FakeDB(rows=[_entity_row(own_id)])
    mgr = _data_manager(monkeypatch, db)
    monkeypatch.setattr(mgr, "get_scenario_id", lambda: _coro(scenario_id))

    await mgr._persist_entity_list_to_db(
        "npcs", [{"id": str(own_id), "data": {"hp": 3}, "tags": ["a"]}]
    )

    assert len(db.statements) == 1
    sql = str(db.statements[0])
    assert "scenario_id" in sql, sql
    assert db.committed is True


@pytest.mark.asyncio
async def test_persist_ignores_entities_of_another_scenario(monkeypatch):
    """An id the scoped query did not return must not be written anywhere."""
    own_id = uuid.uuid4()
    foreign_id = uuid.uuid4()

    # The scoped SELECT only ever returns the entity of this scenario.
    db = _FakeDB(rows=[_entity_row(own_id)])
    mgr = _data_manager(monkeypatch, db)
    monkeypatch.setattr(mgr, "get_scenario_id", lambda: _coro(uuid.uuid4()))

    await mgr._persist_entity_list_to_db(
        "npcs",
        [
            {"id": str(own_id), "data": {"hp": 1}},
            {"id": str(foreign_id), "data": {"hp": 999}},
        ],
    )

    written = {row.id: row.data for row in db.rows}
    assert written == {own_id: {"hp": 1}}
    assert foreign_id not in written


@pytest.mark.asyncio
async def test_persist_skips_malformed_ids_without_touching_db(monkeypatch):
    db = _FakeDB()
    mgr = _data_manager(monkeypatch, db)
    monkeypatch.setattr(mgr, "get_scenario_id", lambda: _coro(uuid.uuid4()))

    await mgr._persist_entity_list_to_db("npcs", [{"id": "not-a-uuid", "data": {}}])

    assert db.statements == []
    assert db.committed is False


# --- BE-02 / BE-03 / BE-04: route level access control ---------------------


def _routes():
    return [r for r in _app().routes if hasattr(r, "path") and hasattr(r, "methods")]


def test_get_session_by_id_route_is_gone():
    """GET /session/{id} called a non-existent manager method and always 500'd."""
    offenders = [
        r for r in _routes()
        if r.path.endswith("/session/{session_id}") and "GET" in (r.methods or set())
    ]
    assert offenders == []


def test_rulesystems_reload_requires_admin():
    from app.auth.role import require_admin

    reload_routes = [
        r for r in _routes()
        if r.path.endswith("/rulesystems/reload") and "POST" in (r.methods or set())
    ]
    assert len(reload_routes) == 1

    calls = [d.call for d in reload_routes[0].dependant.dependencies]
    assert require_admin in calls


@pytest.mark.asyncio
async def test_delete_session_rejects_non_master(monkeypatch):
    session_routes = _module("app.routes.websocket.session")

    class _Mgr:
        async def session_exists(self):
            return True

        async def is_master(self, user):
            return False

        async def delete_session(self):
            raise AssertionError("must not delete for a non-master")

    monkeypatch.setattr(
        session_routes.session_manager, "ensure_manager", lambda sid: _coro(_Mgr())
    )

    with pytest.raises(HTTPException) as exc:
        await session_routes.delete_session(
            session_id=str(uuid.uuid4()), current_user=SimpleNamespace(id=uuid.uuid4())
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_delete_session_allows_master(monkeypatch):
    session_routes = _module("app.routes.websocket.session")

    deleted = []

    class _Mgr:
        async def session_exists(self):
            return True

        async def is_master(self, user):
            return True

        async def delete_session(self):
            deleted.append(True)

    monkeypatch.setattr(
        session_routes.session_manager, "ensure_manager", lambda sid: _coro(_Mgr())
    )

    result = await session_routes.delete_session(
        session_id=str(uuid.uuid4()), current_user=SimpleNamespace(id=uuid.uuid4())
    )
    assert result == {"status": "deleted"}
    assert deleted == [True]


# --- BE-05: session list must stay scoped to the caller --------------------


def _session_manager_with_fake_db(monkeypatch, db):
    # app.managers re-exports the session_manager singleton under the same name
    # as the submodule, so `import ... as` would bind the instance.
    module = _module("app.managers.session_manager")

    async def _fake_get_db():
        yield db

    monkeypatch.setattr(module, "get_db", _fake_get_db)
    return module.SessionManager()


@pytest.mark.asyncio
async def test_list_sessions_filters_by_user(monkeypatch):
    db = _FakeDB()
    manager = _session_manager_with_fake_db(monkeypatch, db)

    await manager.list_sessions(SimpleNamespace(id=uuid.uuid4()))

    assert len(db.statements) == 1
    sql = str(db.statements[0])
    # players.any(...) compiles to EXISTS; master_id alone appears in the
    # selected columns, so it cannot tell a scoped query from an open one.
    assert "EXISTS" in sql, sql
    assert "master_id = " in sql, sql


@pytest.mark.asyncio
async def test_list_sessions_without_user_stays_unfiltered(monkeypatch):
    """Internal callers (observer rooms) rely on the unscoped listing."""
    db = _FakeDB()
    manager = _session_manager_with_fake_db(monkeypatch, db)

    await manager.list_sessions()

    sql = str(db.statements[0])
    assert "EXISTS" not in sql, sql


# --- BE-14: default secret key --------------------------------------------


def test_default_secret_key_rejected_in_production():
    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        validate_secret_key(DEFAULT_SECRET_KEY, "production")


def test_empty_secret_key_rejected_in_production():
    """compose expands ${SECRET_KEY} to '' when the variable is missing."""
    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        validate_secret_key("", "production")


def test_default_secret_key_allowed_in_development():
    validate_secret_key(DEFAULT_SECRET_KEY, "development")
    validate_secret_key("", "development")


def test_custom_secret_key_accepted_in_production():
    validate_secret_key("a-real-secret", "production")
