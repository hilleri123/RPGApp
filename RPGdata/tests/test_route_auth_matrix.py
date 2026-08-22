"""Матрица прав доступа по всем роутам (INF-06).

Ни один из BE-03, BE-04, BE-08, BE-10 — «эндпоинт без аутентификации» — не
дожил бы до прода при наличии этого теста. Он не проверяет логику прав, только
факт: у роута есть зависимость, требующая пользователя, либо роут внесён в
список публичных осознанно.
"""

from __future__ import annotations

import pytest

from tests.conftest import dependency_names

# Зависимости, любая из которых означает «пользователь обязателен».
AUTH_DEPENDENCIES = {
    "get_current_user",
    "get_current_user_ws",
    "require_master",
    "require_admin",
}

# Публичные роуты. Каждый — с обоснованием: список нужен, чтобы новый открытый
# эндпоинт нельзя было добавить молча.
PUBLIC_ROUTES = {
    ("POST", "/auth/login"): "вход по логину и паролю",
    ("POST", "/auth/logout"): "сброс кук, работает и без валидного токена",
    ("POST", "/auth/register"): "регистрация",
    ("POST", "/auth/refresh/token"): "обмен refresh-токена, проверяет его сам",
    ("POST", "/auth/telegram"): "вход из бота по подписи Telegram",
    ("POST", "/auth/link"): "вход по magic-link из бота",
    ("POST", "/auth/distribution"): "подписка на рассылку до регистрации",
    ("GET", "/health"): "liveness-проба для healthcheck в compose",
    ("GET", "/rulesystems"): "каталог систем правил, данных пользователей нет",
}

# WS-каналы, открытые осознанно. Каталог комнат (`GET /session-obs/rooms`)
# при этом закрыт, иначе коды можно было бы просто перечислить.
PUBLIC_WEBSOCKETS = {
    "/session-obs/ws/{code}": "вход зрителя по коду трансляции — анонимный по замыслу",
}


def _route_keys(route) -> list[tuple[str, str]]:
    return [(method, route.path) for method in sorted(route.methods) if method != "HEAD"]


def test_every_http_route_requires_auth_or_is_public(api_routes):
    unprotected = []
    for route in api_routes:
        if dependency_names(route) & AUTH_DEPENDENCIES:
            continue
        for key in _route_keys(route):
            if key not in PUBLIC_ROUTES:
                unprotected.append(key)

    assert not unprotected, (
        "Роуты без аутентификации и без записи в PUBLIC_ROUTES: "
        + ", ".join(f"{method} {path}" for method, path in sorted(unprotected))
    )


def test_public_list_has_no_stale_entries(api_routes):
    """Список публичных роутов не должен переживать удаление самих роутов."""
    existing = {key for route in api_routes for key in _route_keys(route)}
    stale = sorted(key for key in PUBLIC_ROUTES if key not in existing)
    assert not stale, (
        "В PUBLIC_ROUTES остались несуществующие роуты: "
        + ", ".join(f"{method} {path}" for method, path in stale)
    )


def test_public_list_only_covers_unprotected_routes(api_routes):
    """Роут, которому добавили аутентификацию, надо убрать из списка."""
    protected_public = []
    for route in api_routes:
        if not (dependency_names(route) & AUTH_DEPENDENCIES):
            continue
        protected_public.extend(key for key in _route_keys(route) if key in PUBLIC_ROUTES)

    assert not protected_public, (
        "Роуты защищены, но всё ещё числятся публичными: "
        + ", ".join(f"{method} {path}" for method, path in sorted(protected_public))
    )


def test_websocket_routes_authenticate_the_connection(websocket_routes):
    """WS-соединение тоже должно проверять пользователя — иначе слушать может любой.

    Через `Depends` это не сделать: токен читается уже после `websocket.accept()`,
    поэтому обработчики зовут `get_current_user_ws` сами. Смотрим на имена,
    которые обработчик вызывает в теле.
    """
    assert websocket_routes, "WS-роуты не найдены, тест потерял смысл"
    unprotected = [
        route.path
        for route in websocket_routes
        if not (
            dependency_names(route) & AUTH_DEPENDENCIES
            or AUTH_DEPENDENCIES & set(route.endpoint.__code__.co_names)
            or route.path in PUBLIC_WEBSOCKETS
        )
    ]
    assert not unprotected, "WS-роуты без аутентификации: " + ", ".join(sorted(unprotected))


@pytest.mark.parametrize(
    "method, path",
    [
        ("POST", "/rulesystems/reload"),
        ("GET", "/access_groups/{group_id}"),
    ],
)
def test_admin_only_routes_require_admin(api_routes, method, path):
    matches = [
        route for route in api_routes if route.path == path and method in route.methods
    ]
    assert matches, f"роут {method} {path} не найден"
    assert "require_admin" in dependency_names(matches[0])
