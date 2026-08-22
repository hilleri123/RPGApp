"""Regression tests for wave 3: unauthenticated endpoints, IDOR and cookies.

Covers the open observer catalogue and config editor, the location routes that
checked the scenario from the request but loaded the location by bare id, the
inverted duplicate check on registration, path traversal in the media helper,
the wildcard CORS origin combined with credentials, insecure auth cookies and
the dead token lifetime constants.
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
    """Все зависимости роута, включая унаследованные от роутера."""
    return [d.call for d in route.dependant.dependencies]


class _FakeResult:
    def __init__(self, row):
        self._row = row

    def scalars(self):
        return self

    def first(self):
        return self._row


class _RecordingDB:
    """Запоминает выражения, которые до неё дошли, и отдаёт фиксированную строку."""

    def __init__(self, row=None):
        self.row = row
        self.statements = []

    async def execute(self, stmt):
        self.statements.append(stmt)
        return _FakeResult(self.row)

    async def commit(self):
        return None


# --- BE-08: каталог обсервер-комнат ----------------------------------------


def test_observer_rooms_requires_authentication():
    """В превью комнаты входит её код, поэтому анонимный список — это
    перечислимый доступ ко всем идущим играм."""
    from app.auth import get_current_user

    route = _route("/session-obs/rooms", "GET")
    assert get_current_user in _dependency_calls(route)


@pytest.mark.asyncio
async def test_observer_rooms_narrows_list_to_viewer():
    """Обычный пользователь видит только свои комнаты, админ — все."""
    observers = _module("app.routes.websocket.observers")
    captured = {}

    class _FakeManager:
        async def list_observer_rooms(self, **kwargs):
            captured.update(kwargs)
            return []

    original = observers.session_manager
    observers.session_manager = _FakeManager()
    try:
        plain = SimpleNamespace(id=uuid.uuid4(), is_admin=False)
        await observers.list_observer_rooms(
            search=None, sort="created", order="desc", current_user=plain
        )
        assert captured["viewer"] is plain

        admin = SimpleNamespace(id=uuid.uuid4(), is_admin=True)
        await observers.list_observer_rooms(
            search=None, sort="created", order="desc", current_user=admin
        )
        assert captured["viewer"] is None
    finally:
        observers.session_manager = original


def test_list_observer_rooms_passes_viewer_to_session_filter():
    """list_sessions уже умеет фильтровать по участию — используем это."""
    import inspect

    manager = _module("app.managers.session_manager")
    src = inspect.getsource(manager.SessionManager.list_observer_rooms)
    assert "list_sessions(user=viewer)" in src


# --- BE-09: лобби принимает любого -----------------------------------------


def test_lobby_catalogue_does_not_expose_scenario_body():
    """Список лобби видит любой аутентифицированный пользователь, поэтому
    выбранный сценарий мастера в нём отдавать нельзя."""
    from app import scheme

    fields = set(scheme.LobbyPreview.model_fields)
    assert "scenario" not in fields and "characters" not in fields
    assert "scenario_name" in fields


def test_lobby_list_route_returns_preview():
    from app import scheme

    for path in ("/lobby", "/lobby/"):
        route = _route(path, "GET")
        args = getattr(route.response_model, "__args__", ())
        assert args == (scheme.LobbyPreview,), f"{path}: {route.response_model}"


def test_lobby_has_ban_list():
    """Без хранимого списка выгнанных кик бессмыслен: WebSocket добавляет
    пользователя обратно на следующем реконнекте."""
    from app import scheme

    assert "banned_user_ids" in scheme.Lobby.model_fields


def test_websocket_refuses_banned_user():
    import inspect

    lobby = _module("app.routes.websocket.lobby")
    src = inspect.getsource(lobby.websocket_endpoint)
    # Проверка стоит именно в ветке автодобавления нового участника.
    assert "is_banned" in src
    assert src.index("is_banned") < src.index("add_to_lobby")


def test_kick_player_bans_user():
    import inspect

    manager = _module("app.managers.lobby_manager")
    src = inspect.getsource(manager.CurrentLobbyManager.kick_player)
    assert "_ban_user_id" in src


# --- BE-10: config_editor без аутентификации -------------------------------


def test_config_editor_router_requires_authentication():
    """Роутер отдавал схемы и справочные данные для произвольного scenario_id."""
    from app.auth import get_current_user

    editor_paths = [
        r for r in _routes()
        if "/schema" in r.path or "/init" in r.path or "/options" in r.path
        or "/editor-config" in r.path or r.path.endswith("/config")
    ]
    assert editor_paths, "эндпоинты редактора не найдены"

    unprotected = [
        r.path for r in editor_paths
        if get_current_user not in _dependency_calls(r)
    ]
    assert unprotected == [], f"без аутентификации: {unprotected}"


def test_config_editor_scenario_endpoints_check_scenario_access():
    import inspect

    editor = _module("app.routes.rules.config_editor")
    for name in (
        "editor_schema_for_scenario",
        "editor_init_for_scenario",
        "editor_options_for_scenario",
        "editor_config_for_scenario",
    ):
        src = inspect.getsource(getattr(editor, name))
        assert "require_scenario_by_id" in src, name


# --- BE-11: IDOR в локациях ------------------------------------------------


@pytest.mark.asyncio
async def test_load_location_filters_by_scenario():
    """Мастер сценария A не должен доставать локацию сценария B, подставив
    свой scenario_id и чужой location_id."""
    locations = _module("app.routes.locations")
    db = _RecordingDB(row=None)

    with pytest.raises(HTTPException) as exc:
        await locations._load_location(db, uuid.uuid4(), uuid.uuid4())
    assert exc.value.status_code == 404

    where = str(db.statements[0])
    assert "location.scenario_id" in where
    assert "location.id" in where


@pytest.mark.asyncio
async def test_parent_location_must_belong_to_same_scenario():
    locations = _module("app.routes.locations")
    db = _RecordingDB(row=None)

    with pytest.raises(HTTPException):
        await locations._check_parent_location(db, uuid.uuid4(), uuid.uuid4())
    assert "location.scenario_id" in str(db.statements[0])


def test_no_location_lookup_bypasses_scenario_scope():
    """Все выборки локации идут через хелперы со скоупом сценария."""
    import inspect

    locations = _module("app.routes.locations")
    src = inspect.getsource(locations)
    # Небезопасный паттерн: выборка только по id вне хелперов.
    assert "select(models.Location).where(models.Location.id == location_id)" not in src


# --- BE-18: path traversal -------------------------------------------------


def test_path_from_url_rejects_traversal():
    """Путь уходит в unlink(), то есть промах — это удаление чужого файла."""
    s3 = _module("app.infrastructure.s3_service")

    assert s3._path_from_url("http://host/media/../../etc/passwd") is None
    assert s3._path_from_url("http://host/media/a/../../../etc/shadow") is None


def test_path_from_url_keeps_normal_paths():
    s3 = _module("app.infrastructure.s3_service")

    path = s3._path_from_url("http://host/media/location/1/icon.png")
    assert path is not None
    assert path.name == "icon.png"
    assert str(s3.MEDIA_ROOT.resolve()) in str(path)


def test_path_from_url_ignores_cache_busting_query():
    s3 = _module("app.infrastructure.s3_service")

    path = s3._path_from_url("http://host/media/npc/a.png?v=123")
    assert path is not None and path.name == "a.png"


# --- BE-20: инвертированная проверка дубликата -----------------------------


@pytest.mark.asyncio
async def test_register_rejects_existing_name():
    """Раньше найденный пользователь не давал исключения, и код шёл создавать
    дубликат; ошибка выдавалась наоборот — при внутреннем сбое поиска."""
    matvei = _module("app.routes.auth.matvei")
    from app import scheme

    existing = SimpleNamespace(id=uuid.uuid4(), full_name="Занято", email="a@b.c")
    db = _RecordingDB(row=existing)
    payload = scheme.UserCreate(full_name="Занято", email="new@b.c", password="123456")

    with pytest.raises(HTTPException) as exc:
        await matvei.register_user(user=payload, db=db)
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_register_rejects_existing_email():
    matvei = _module("app.routes.auth.matvei")
    from app import scheme

    # Первый запрос (по имени) не находит никого, второй (по email) — находит.
    class _DB(_RecordingDB):
        def __init__(self):
            super().__init__()
            self.calls = 0

        async def execute(self, stmt):
            self.calls += 1
            self.row = None if self.calls == 1 else SimpleNamespace(id=uuid.uuid4())
            return await super().execute(stmt)

    payload = scheme.UserCreate(full_name="Новый", email="taken@b.c", password="123456")
    with pytest.raises(HTTPException) as exc:
        await matvei.register_user(user=payload, db=_DB())
    assert exc.value.status_code == 400
    assert "Email" in exc.value.detail


# --- BE-12: CORS ----------------------------------------------------------


def test_cors_origins_are_explicit():
    """Со allow_credentials=True звёздочка запрещена спецификацией CORS."""
    from app.infrastructure.settings import settings

    assert "*" not in settings.cors_origins
    assert settings.cors_origins, "список origin-ов не должен быть пустым"


def test_cors_middleware_uses_settings():
    main = _module("app.main")
    from app.infrastructure.settings import settings

    cors = [
        m for m in main.app.user_middleware
        if m.cls.__name__ == "CORSMiddleware"
    ]
    assert len(cors) == 1
    configured = cors[0].kwargs.get("allow_origins")
    assert configured == settings.cors_origins
    assert "*" not in configured


def test_cors_origins_parsed_from_csv():
    from app.infrastructure.settings import Settings

    s = Settings(cors_origins_raw="https://a.example, https://b.example ,")
    assert s.cors_origins == ["https://a.example", "https://b.example"]


# --- BE-13: cookies -------------------------------------------------------


def test_cookie_secure_follows_settings():
    """Флаг больше не захардкожен: в проде включается, локально по http выключен."""
    import inspect

    matvei = _module("app.routes.auth.matvei")
    src = inspect.getsource(matvei._set_auth_cookies)
    assert "secure=settings.cookie_secure" in src
    assert "secure=False" not in src


def test_refresh_endpoint_reuses_cookie_helper():
    """Refresh дублировал установку куки со своим secure=False."""
    import inspect

    matvei = _module("app.routes.auth.matvei")
    src = inspect.getsource(matvei)
    assert src.count("secure=") == 2, "остались другие места установки куки"


def test_cookie_secure_enabled_in_production():
    from app.infrastructure.settings import resolve_cookie_secure

    assert resolve_cookie_secure(None, "production") is True
    assert resolve_cookie_secure("", "production") is True
    assert resolve_cookie_secure(None, "development") is False


def test_cookie_secure_can_be_forced_by_env():
    from app.infrastructure.settings import resolve_cookie_secure

    assert resolve_cookie_secure("true", "development") is True
    assert resolve_cookie_secure("false", "production") is False


# --- BE-21: время жизни токенов -------------------------------------------


def test_token_lifetime_constants_removed():
    """Константы объявлялись дважды подряд; работавшие значения давали
    access-токен на 91 год."""
    auth_utils = _module("app.auth.auth_utils")

    assert not hasattr(auth_utils, "AUTH_TIMEOUT_SECONDS")
    assert not hasattr(auth_utils, "REFRESH_TOKEN_EXPIRE_DAYS")


def test_token_lifetimes_come_from_settings():
    from app.auth.auth_utils import TokenManager
    from app.infrastructure.settings import settings

    assert TokenManager.access_token_expire_hours == settings.access_token_lifetime_hours
    assert TokenManager.refresh_token_expire_days == settings.refresh_token_lifetime_days
    # Здоровые границы: не десятилетия.
    assert TokenManager.access_token_expire_hours <= 24 * 14
    assert TokenManager.refresh_token_expire_days <= 90
