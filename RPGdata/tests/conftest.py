"""Общие фикстуры для тестов бэкенда (INF-06).

До этого файла общих фикстур не было вообще: каждый тест сам импортировал
`app.main` и сам собирал список роутов. Импорт `app.main` тянет за собой все
плагины правил, поэтому он вынесен в session-scoped фикстуру — один раз на
прогон.
"""

from __future__ import annotations

import importlib
from typing import Any, List

import pytest


@pytest.fixture(scope="session")
def fastapi_app() -> Any:
    """Приложение FastAPI со всеми подключёнными роутерами."""
    return importlib.import_module("app.main").app


@pytest.fixture(scope="session")
def api_routes(fastapi_app: Any) -> List[Any]:
    """Только HTTP-роуты: без WebSocket, статики и служебных маршрутов."""
    from fastapi.routing import APIRoute

    return [route for route in fastapi_app.routes if isinstance(route, APIRoute)]


@pytest.fixture(scope="session")
def websocket_routes(fastapi_app: Any) -> List[Any]:
    from fastapi.routing import APIWebSocketRoute

    return [route for route in fastapi_app.routes if isinstance(route, APIWebSocketRoute)]


def dependency_names(route: Any) -> set[str]:
    """Имена всех зависимостей роута, включая унаследованные от роутера.

    FastAPI складывает зависимости в дерево: `Depends` внутри `Depends`
    оказывается на уровень глубже, а `dependencies=[...]` роутера — рядом с
    зависимостями обработчика. Проверять только верхний уровень недостаточно.
    """
    names: set[str] = set()
    stack = [route.dependant]
    while stack:
        dependant = stack.pop()
        if dependant.call is not None:
            names.add(getattr(dependant.call, "__name__", str(dependant.call)))
        stack.extend(dependant.dependencies)
    return names


@pytest.fixture
def api_client(fastapi_app: Any):
    """ASGI-клиент поверх приложения, без сети.

    Пропускает тест, если `httpx` не установлен: в рабочем образе его нет, и
    падение по ImportError выглядело бы как провал самого теста.
    """
    httpx = pytest.importorskip("httpx", reason="httpx нужен для ASGI-клиента")
    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=fastapi_app),
        base_url="http://testserver",
    )
