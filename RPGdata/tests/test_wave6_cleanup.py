"""Regression tests for wave 6: prod secrets, exposed databases and dead infra.

Covers INF-04 (RabbitMQ credentials defaulting to rpg:rpg and Postgres/Redis
ports published from the production compose file) and INF-07 (the MongoDB and
Kafka scaffolding nothing imported).
"""

from __future__ import annotations

import importlib
import pathlib

import pytest
import yaml


def _module(name: str):
    """Импорт модуля приложения.

    Проверки конфигов читают файлы репозитория и работают где угодно, а вот код
    приложения импортируется только там, где установлены зависимости, — то есть
    в контейнере. Снаружи такие тесты пропускаются, как и в `test_wave5_infra`.
    """
    try:
        importlib.import_module("app.main")
        return importlib.import_module(name)
    except ImportError as exc:
        pytest.skip(f"приложение недоступно из окружения тестов: {exc}")


def _repo_root() -> pathlib.Path:
    """tests/ -> RPGdata/ -> корень монорепозитория, где лежат compose-файлы."""
    return pathlib.Path(__file__).resolve().parents[2]


def _config(name: str) -> str:
    path = _repo_root() / name
    if not path.exists():
        pytest.skip(f"{name} недоступен из окружения тестов")
    return path.read_text()


def _prod_compose() -> dict:
    return yaml.safe_load(_config("compose.prod.yml"))


# --- INF-04: креды по умолчанию и БД наружу --------------------------------


@pytest.mark.parametrize("variable", ["RABBIT_URL", "RABBITMQ_DEFAULT_USER", "RABBITMQ_DEFAULT_PASS"])
def test_prod_rabbit_credentials_have_no_defaults(variable):
    """С `:-rpg` прод молча поднимался с паролем из публичного репозитория.

    Форма `${VAR:?...}` роняет compose на старте с внятным сообщением — в
    отличие от тихой подстановки дефолта.
    """
    text = _config("compose.prod.yml")

    assert f"${{{variable}:-" not in text, f"{variable} снова получил значение по умолчанию"
    assert f"${{{variable}:?" in text, f"{variable} должен быть обязательным в проде"


@pytest.mark.parametrize("service", ["db", "redis"])
def test_prod_does_not_publish_database_ports(service):
    """Postgres и Redis общаются с приложением внутри сети compose. Публикация
    порта наружу давала прямую поверхность атаки без всякой пользы."""
    definition = _prod_compose()["services"][service]

    assert not definition.get("ports"), f"{service} снова публикует порт наружу"
    assert definition.get("expose"), f"{service} должен объявлять порт через expose"


def test_dev_compose_still_publishes_ports_for_debugging():
    """Локально доступ к БД снаружи нужен — правка касается только прода."""
    dev = yaml.safe_load(_config("compose.dev.yml"))

    assert dev["services"]["db"].get("ports")


# --- INF-07: мёртвая инфраструктура ----------------------------------------


@pytest.mark.parametrize("filename", ["mongo.py", "redis_matvei.py"])
def test_dead_infrastructure_modules_are_gone(filename):
    """Ни один из модулей никуда не импортировался: обработчики Mongo были
    закомментированы, а Kafka-продюсер вообще падал бы на NameError."""
    infra = _repo_root() / "RPGdata" / "app" / "infrastructure"
    if not infra.exists():
        pytest.skip("исходники недоступны из окружения тестов")

    assert not (infra / filename).exists()


def test_settings_have_no_mongo_url():
    settings = _module("app.infrastructure.settings").settings

    assert not hasattr(settings, "mongodb_url")


@pytest.mark.parametrize("package", ["motor", "pymongo"])
def test_mongo_packages_are_not_installed(package):
    """Лишние зависимости в образе — лишние CVE."""
    requirements = _config("RPGdata/requirements.txt")

    assert package not in requirements


def test_main_has_no_commented_out_startup_handlers():
    source = _config("RPGdata/app/main.py")

    assert "connect_to_mongo" not in source


# --- INF-06: общие фикстуры для тестов ------------------------------------


def test_shared_fixtures_are_available():
    """`conftest.py` не было вообще — каждый тест поднимал приложение сам."""
    conftest = pathlib.Path(__file__).parent / "conftest.py"

    assert conftest.exists()
    source = conftest.read_text()
    for fixture in ("fastapi_app", "api_routes", "websocket_routes", "api_client"):
        assert f"def {fixture}" in source, f"фикстура {fixture} пропала"


# --- BE-16: гонки при параллельной отправке действий -----------------------


class _FakeRedis:
    """Ровно та часть Redis, которой пользуется блокировка."""

    def __init__(self) -> None:
        self.store: dict[str, str] = {}

    async def set(self, key, value, nx=False, px=None):
        if nx and key in self.store:
            return None
        self.store[key] = value
        return True

    async def eval(self, script, numkeys, key, token):
        if self.store.get(key) == token:
            del self.store[key]
            return 1
        return 0


@pytest.fixture
def fake_redis(monkeypatch):
    locks = _module("app.managers.session.locks")
    fake = _FakeRedis()
    monkeypatch.setattr(locks, "redis_client", fake)
    return fake


@pytest.mark.asyncio
async def test_lock_serialises_two_writers(fake_redis):
    """Пока один держит блокировку, второй ждёт, а не пишет параллельно."""
    import asyncio

    locks = _module("app.managers.session.locks")
    order: list[str] = []

    async def writer(name: str, hold: float):
        async with locks.session_write_lock("session:1"):
            order.append(f"{name} взял")
            await asyncio.sleep(hold)
            order.append(f"{name} отпустил")

    await asyncio.gather(writer("A", 0.05), writer("B", 0.0))

    assert order == ["A взял", "A отпустил", "B взял", "B отпустил"]


@pytest.mark.asyncio
async def test_lock_is_released_after_failure(fake_redis):
    """Исключение внутри блока не должно оставлять сессию заблокированной."""
    locks = _module("app.managers.session.locks")

    with pytest.raises(RuntimeError):
        async with locks.session_write_lock("session:2"):
            raise RuntimeError("ход не прошёл")

    assert fake_redis.store == {}


@pytest.mark.asyncio
async def test_lock_gives_up_instead_of_hanging(fake_redis):
    """Ожидание ограничено: висящий запрос хуже честной ошибки."""
    locks = _module("app.managers.session.locks")

    async with locks.session_write_lock("session:3"):
        with pytest.raises(locks.SessionLockTimeout):
            async with locks.session_write_lock("session:3", wait_seconds=0.05):
                pass


@pytest.mark.asyncio
async def test_release_does_not_touch_someone_elses_lock(fake_redis):
    """После истечения TTL блокировку берёт другой — снимать её нельзя."""
    locks = _module("app.managers.session.locks")

    async with locks.session_write_lock("session:4"):
        fake_redis.store["lock:session:4"] = "чужой-токен"

    assert fake_redis.store["lock:session:4"] == "чужой-токен"


@pytest.mark.parametrize("method", ["create_action", "submit_action", "patch_action", "cancel_action"])
def test_action_mutators_are_serialised(method):
    manager = _module("app.managers.session.action_manager").SessionActionManager

    assert hasattr(getattr(manager, method), "__wrapped__"), (
        f"{method} снова пишет список действий без блокировки"
    )


@pytest.mark.parametrize("method", ["submit_action_step", "patch_action_step", "run_scene_action"])
def test_step_helpers_do_not_take_the_lock(method):
    """Они зовут мутаторы изнутри: второй захват той же блокировки — дедлок."""
    manager = _module("app.managers.session.action_manager").SessionActionManager

    assert not hasattr(getattr(manager, method), "__wrapped__")


# --- BE-07: реестр менеджеров в памяти процесса -----------------------------


def test_prod_runs_exactly_one_worker():
    """Кеш сущностей внутри менеджеров сессий не разделяется между воркерами,
    поэтому «один воркер» зафиксирован явно, а не держится на дефолте uvicorn."""
    command = _prod_compose()["services"]["app"]["command"]

    assert "--workers" in command
    assert command[command.index("--workers") + 1] == "1"
