# Дефекты инфраструктуры

Compose, nginx, скрипты, конфигурация, тесты. Снимок на коммит `fb13687`.

## Сводка

| ID | Severity | Кратко |
|----|----------|--------|
| [INF-01](#inf-01) | high · исправлено | `Makefile` и `migrate.sh` ссылаются на несуществующий `docker-compose.yml` |
| [INF-02](#inf-02) | high · исправлено | nginx проксирует на порты, которых compose не публикует |
| [INF-03](#inf-03) | medium · исправлено | Нет healthcheck у `app`, `web-client`, `telegram-bot` |
| [INF-04](#inf-04) | medium · исправлено | Дефолтные креды RabbitMQ и порты БД наружу |
| [INF-05](#inf-05) | medium · исправлено | `.env.example` расходится с тем, что читает код |
| [INF-06](#inf-06) | medium · частично | Тесты: только unit, нет `conftest.py` и интеграционных |
| [INF-07](#inf-07) | low · исправлено | Мёртвая инфраструктура: MongoDB и Kafka |
| [INF-08](#inf-08) | low · не исправляем | Дублирующиеся имена миграций |
| [INF-09](#inf-09) | medium · исправлено | Два теста падают только при полном прогоне: общее состояние между тестами |

---

### INF-01

**`Makefile` и `migrate.sh` ссылаются на несуществующий `docker-compose.yml`**

**Где:** [Makefile:9-25](../Makefile), [migrate.sh:6-7](../migrate.sh)

```makefile
docker-compose up app frontend-dev
```

```bash
COMPOSE_FILE=${2:-"docker-compose.yml"}
SERVICE_NAME=${3:-"app"}
```

**Проблема.** В репозитории есть только `compose.dev.yml` и `compose.prod.yml` — файла `docker-compose.yml` нет. Сервис `frontend-dev` тоже не существует, в compose он называется `web-client`. То есть **все** цели Makefile и дефолтный запуск `migrate.sh` падают.

При этом [CLAUDE.md](../CLAUDE.md) документирует правильную команду `docker compose -f compose.dev.yml up`, то есть Makefile просто отстал от переименования файлов.

Отдельно: `docker-compose` (с дефисом) — это Compose V1, снятый с поддержки; актуален `docker compose`.

**Решение.** Обновить Makefile на `docker compose -f compose.dev.yml` и сервис `web-client`, в `migrate.sh` поменять дефолт `COMPOSE_FILE` на `compose.dev.yml`. Проверять цели Makefile в CI, иначе они снова разойдутся.

**Исправлено.** `Makefile` и `migrate.sh` переведены на `docker compose` (V2) и на реальные файлы `compose.dev.yml` / `compose.prod.yml`, сервис `frontend-dev` заменён на `web-client`. В `Makefile` добавлены цели `test` и `migrate` через `docker compose exec`, а `migrate.sh` определяет запущенный контейнер через `ps --status running`.

---

### INF-02

**nginx проксирует на порты, которых compose не публикует**

**Где:** [nginx/sites-enabled/byury.online:26, 35](../nginx/sites-enabled/byury.online)

```nginx
proxy_pass http://localhost:3000;
...
proxy_pass http://localhost:8000/;
```

**Проблема.** Порты `3000` и `8000` — **внутренние** порты контейнеров. Наружу compose публикует `6602:3000` и `6601:8000` (см. [compose.prod.yml:50, 75](../compose.prod.yml)). Если nginx работает на хосте, а не в сети Docker, эти `proxy_pass` уходят в никуда — сайт отдаёт 502.

Дополнительно конфиг ссылается на домен `byury.online`, тогда как `compose.prod.yml` настроен на `rpgzona.ru` (`BASE_URL`, `WEB_CLIENT_URL`). Конфиг относится к другому развёртыванию и, судя по всему, не обновлялся.

**Решение.** Привести порты к `6601`/`6602` и домен к актуальному, либо завести nginx как сервис в compose-сети и обращаться к контейнерам по именам (`http://app:8000`, `http://web-client:3000`) — второй вариант устойчивее, потому что не зависит от опубликованных портов.

**Исправлено.** Конфиг переименован в `nginx/sites-enabled/rpgzona.ru`, `server_name` приведён к рабочему домену. `proxy_pass` теперь идёт на `127.0.0.1:6601` (API) и `127.0.0.1:6602` (веб-клиент) — то есть на порты, которые compose действительно публикует. Заодно поднят `client_max_body_size` под загрузку медиа и таймауты `proxy_read_timeout` / `proxy_send_timeout` под долгие WebSocket-соединения. Блоки MinIO удалены: этого сервиса в compose нет.

---

### INF-03

**Нет healthcheck у `app`, `web-client`, `telegram-bot`**

**Где:** [compose.prod.yml:25-83](../compose.prod.yml), [161](../compose.prod.yml)

**Проблема.** Инфраструктурные сервисы healthcheck-и имеют: `db` (строка 101), `redis` (134), `rabbitmq` (149). У прикладных сервисов их нет.

Последствия конкретные. `web-client` объявляет `depends_on: [app]` короткой формой (строка 81-82), которая означает лишь «контейнер запущен», а не «приложение отвечает». Фронтенд стартует раньше готовности API. Docker не может перезапустить зависший процесс, потому что не знает, что тот завис: `restart: unless-stopped` срабатывает только на выход процесса, а не на потерю работоспособности.

**Решение.** Добавить healthcheck на `/health` для `app` и на корень для `web-client`, перевести `depends_on` на длинную форму с `condition: service_healthy`. Для `telegram-bot` — проверку живости соединения с RabbitMQ.

**Исправлено.** В приложении появился открытый эндпоинт `GET /health`, на него настроен healthcheck сервиса `app` в обоих compose-файлах. В проде добавлен healthcheck `web-client`, а сам `web-client` ждёт `app` в состоянии `service_healthy` — до этого он мог начать отвечать раньше, чем поднимется API.

У `telegram-bot` healthcheck осознанно не добавлен: слушающего порта у него нет, а проверка «процесс жив» ничего не сообщает сверх `restart: unless-stopped`. Осмысленной пробой был бы ответ бота на RPC через RabbitMQ — для этого нужен эндпоинт в самом боте, это отдельная задача.

---

### INF-04

**Дефолтные креды RabbitMQ и порты БД наружу**

**Где:** [compose.prod.yml:47, 145-146, 169](../compose.prod.yml), те же значения в [compose.dev.yml:18, 103-104, 124](../compose.dev.yml)

```yaml
RABBIT_URL: ${RABBIT_URL:-amqp://rpg:rpg@rabbitmq:5672/}
RABBITMQ_DEFAULT_USER: ${RABBITMQ_DEFAULT_USER:-rpg}
RABBITMQ_DEFAULT_PASS: ${RABBITMQ_DEFAULT_PASS:-rpg}
```

**Проблема.** Пара `rpg:rpg` подставляется, если переменная не задана, — то есть прод молча поднимется с паролем из публичного репозитория. В отличие от `POSTGRES_PASSWORD` и `SECRET_KEY`, которые в проде заданы без дефолта (строки 40, 42) и упадут при отсутствии, здесь ошибка не заметна.

Отдельно `compose.prod.yml` публикует наружу порт PostgreSQL `6603:5432` (строка 100) и Redis `6606:6379` (строка 133). В проде это не нужно — сервисы общаются внутри Docker-сети — и создаёт прямую поверхность атаки на БД.

**Решение.** Убрать дефолтные значения кредов, чтобы отсутствие переменной было ошибкой старта. В `compose.prod.yml` убрать публикацию портов БД и Redis, оставив `expose`.

**Исправлено.** В `compose.prod.yml` `RABBIT_URL`, `RABBITMQ_DEFAULT_USER` и `RABBITMQ_DEFAULT_PASS` переведены с формы `${VAR:-rpg}` на `${VAR:?...}`: без этих переменных прод не поднимется и скажет, чего не хватает, вместо тихой подстановки пароля из публичного репозитория. Публикация портов Postgres (`6603`) и Redis (`6606`) заменена на `expose` — внутри сети compose приложение и так их видит.

В `compose.dev.yml` дефолты и опубликованные порты оставлены: локально доступ к БД снаружи нужен, а `rpg:rpg` в контейнере на ноутбуке ничего не открывает. Разница между dev и prod закреплена тестами в [test_wave6_cleanup.py](../RPGdata/tests/test_wave6_cleanup.py).

---

### INF-05

**`.env.example` расходится с тем, что читает код**

**Где:** [.env.example](../.env.example)

**Проблема.** Файл описывает 10 переменных: `BOT_TOKEN`, `NEXT_PUBLIC_API_URL`, `POSTGRES_*`, `RABBIT*`, `SECRET_KEY`, `WEB_CLIENT_URL`. Код при этом читает ещё как минимум шесть, которых в примере нет:

| Переменная | Где читается |
|-----------|--------------|
| `REDIS_URL` | подключение к Redis |
| `MEDIA_ROOT`, `MEDIA_URL_PREFIX` | [s3_service.py](../RPGdata/app/infrastructure/s3_service.py) |
| `ROOT_PATH` | монтирование API за префиксом |
| `BASE_URL` | генерация ссылок |
| `ALGORITHM` | подпись JWT |

Тот, кто разворачивает проект по `.env.example`, получит дефолты — а часть из них небезопасна (см. `BE-14`). Особенно неприятен `MEDIA_ROOT`: неверное значение означает, что загруженные файлы уйдут не туда, где их ждёт раздача.

**Решение.** Синхронизировать `.env.example` с реальным списком и добавить тест, который сверяет его с обращениями к `os.getenv` в коде.

**Исправлено.** `.env.example` приведён к тому, что действительно читает код: добавлены `ALGORITHM`, `ENV`, `COOKIE_SECURE`, `CORS_ORIGINS`, `MEDIA_ROOT`, `MEDIA_URL_PREFIX`, `BASE_URL`, `ROOT_PATH`, `REDIS_URL`, `BOT_RPC_TIMEOUT`, у каждого — назначение и отдельно значения для прода. Расхождение теперь ловится тестом: он собирает `os.getenv` из кода и сверяет со списком в примере.

---

### INF-06

**Тесты: только unit, нет `conftest.py` и интеграционных**

**Где:** [RPGdata/tests/](../RPGdata/tests)

**Проблема.** На момент снимка — 10 тестовых файлов, все изолированные unit-тесты вокруг плагинов и вспомогательных функций: `test_action_cancel_permissions`, `test_dw_perform_move_helpers`, `test_entity_data_rule`, `test_entity_seen`, `test_move_overrides`, `test_permissions`, `test_plugin_schema`, `test_roll_kit`, `test_scenario_archive`, `test_scenario_cloner`. Волна 1 добавила одиннадцатый — `test_wave1_security`.

`conftest.py` отсутствует, то есть общих фикстур (тестовая БД, Redis, клиент FastAPI) нет в принципе. Из этого следует, что **не покрыто ничего** из следующего:

- HTTP-эндпоинты — ни один. `BE-02` (вызов несуществующего метода) не был бы возможен при простейшем smoke-тесте всех роутов.
- Права доступа на уровне эндпоинтов — `BE-03`, `BE-10`, `BE-11` ловятся одним тестом «чужой пользователь получает 403».
- WebSocket-протокол, ролевые payload-ы.
- Взаимодействие с Redis и Postgres, включая ключевую логику `_session_key()`.
- Прогон миграций от нуля до головы.

У фронтенда тестов нет вообще.

Отдельно: `httpx` не установлен в образе, поэтому `fastapi.testclient.TestClient` недоступен даже там, где он был бы уместен. Тесты волны 1 из-за этого проверяют роуты интроспекцией `app.routes` и вызовом функций-обработчиков напрямую, а не по HTTP.

**Решение.** По убыванию отдачи: добавить `httpx` в зависимости; `conftest.py` с транзакционной тестовой БД и `httpx.AsyncClient`; smoke-тест, обходящий все зарегистрированные роуты; матрица прав доступа по ролям; тест миграций `upgrade head` на чистой БД; интеграционные тесты WebSocket-сценария. Изоляция состояния между тестами — отдельный дефект `INF-09`, и её стоит сделать до наращивания набора.

**Частично исправлено.** Появился `tests/conftest.py` с общими фикстурами: `fastapi_app` (session-scoped, чтобы приложение со всеми плагинами поднималось один раз), `api_routes`, `websocket_routes` и `api_client` поверх `httpx.ASGITransport`. `httpx` добавлен в `requirements-dev.txt`, `pytest.ini` фиксирует `asyncio_mode` и область жизни цикла для фикстур.

Главное — появился [test_route_auth_matrix.py](../RPGdata/tests/test_route_auth_matrix.py): он обходит все 208 HTTP-роутов и все WS-роуты и требует у каждого зависимость, дающую пользователя, либо явную запись в списке публичных с обоснованием. Ни BE-03, ни BE-04, ни BE-08, ни BE-10 при таком тесте до прода бы не дожили. WS-роуты проверяются по вызовам в теле обработчика: токен там читается уже после `websocket.accept()`, через `Depends` это не выразить.

Осталось незакрытым: тестовой БД и Redis по-прежнему нет, поэтому интеграционных тестов эндпоинтов, WebSocket-сценария и прогона миграций от нуля тоже нет. Это требует поднятого Postgres в тестовом окружении — отдельная работа, не правка бага. Тесты фронтенда отсутствуют полностью.

---

### INF-07

**Мёртвая инфраструктура: MongoDB и Kafka**

**Где:** [settings.py:11](../RPGdata/app/infrastructure/settings.py) (в снимке — 5, сдвинулось после правки `BE-14`), [mongo.py](../RPGdata/app/infrastructure/mongo.py), [main.py:48-52](../RPGdata/app/main.py), [redis_matvei.py:8, 202](../RPGdata/app/infrastructure/redis_matvei.py), [requirements.txt:30, 43](../RPGdata/requirements.txt)

```python
# app.add_event_handler("startup", connect_to_mongo)
# app.add_event_handler("shutdown", close_mongo_connection)
```

**Проблема.** MongoDB отключена: обработчики закомментированы, `mongo.py` не импортируется ниоткуда. При этом `motor==3.1.1` и `pymongo==4.3.3` остаются в зависимостях, а `mongodb_url` — в настройках с дефолтным паролем `admin:admin`.

Похожая история с Kafka: `redis_matvei.py` создаёт продюсер с `bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS`, а переменная нигде не задаётся — значит `None`.

Это не ломает работу, но вводит в заблуждение: читающий код считает, что Mongo и Kafka — часть архитектуры, и тратит время на их изучение. Плюс лишние зависимости в образе и лишняя поверхность CVE.

**Решение.** Удалить `mongo.py`, `mongodb_url` и пакеты `motor`/`pymongo`. По Kafka — либо довести до рабочего состояния, либо убрать вместе с веткой в `redis_matvei.py`.

**Исправлено.** `app/infrastructure/mongo.py` и `app/infrastructure/redis_matvei.py` удалены, из настроек убран `mongodb_url` вместе с паролем `admin:admin`, из `requirements.txt` — `motor` и `pymongo`. В `main.py` вместо закомментированных обработчиков Mongo стоит строка о том, что схему накатывает alembic.

Ветку Kafka не «доводили до рабочего состояния», а убрали вместе с файлом: `redis_matvei.py` не импортировался ниоткуда, а `AIOKafkaProducer` в нём даже не был импортирован — первый же вызов `send_message_to_kafka` упал бы на `NameError`. То есть рабочего кода там не было, был макет.

---

### INF-08

**Дублирующиеся имена миграций**

**Где:** [RPGdata/alembic/versions/](../RPGdata/alembic/versions)

**Проблема.** Три ревизии называются `player_character_snapshot` (`1c14e3fbcd43`, `247aef56aacb`, `73974522f0c1`) и две — `templates_to_exposures` (`8ee42590bb5e`, `c4acdad9da2a`). Ещё одна называется просто `test` (`3474aadb9af9`).

На работу это не влияет — цепочка линейна, голова одна (`l1m2n3o4p5q6_roll_record`), 25 ревизий. Но при разборе инцидента с БД одинаковые имена заставляют сверять хеши, чтобы понять, о какой миграции речь.

**Решение.** Переименовывать не стоит — идентификаторы уже в таблице `alembic_version` на проде. Достаточно договориться про осмысленные уникальные `-m` для новых миграций.

**Решено не исправлять.** Идентификаторы ревизий уже лежат в `alembic_version` на проде, а имя миграции ни на что не влияет — переименование даст только риск. Договорённость на будущее: осмысленный уникальный `-m` при создании ревизии. Дубликаты имён остаются как есть.

---

### INF-09

**Два теста падают только при полном прогоне: общее состояние между тестами**

**Где:** [tests/test_dw_perform_move_helpers.py](../RPGdata/tests/test_dw_perform_move_helpers.py) и [tests/test_plugin_schema.py](../RPGdata/tests/test_plugin_schema.py)

**Проблема.** Полный прогон стабильно даёт два падения, которых нет при запуске файла в одиночку:

```
FAILED test_dw_perform_move_helpers.py::test_collect_participating_factories_move_and_codex_fo_only
FAILED test_dw_perform_move_helpers.py::test_bard_arcane_art_builds_forward_draft_on_10_plus
```

Оба падают на утверждениях про фабрики хода `bard_arcane_art` — например `assert any(f.get("source") == "move" and f.get("spec_id") == "forward" ...)` возвращает `False`.

Источник установлен бисекцией — это `test_plugin_schema.py`, причём **важен порядок**:

| Команда | Результат |
|---------|-----------|
| `pytest tests/test_dw_perform_move_helpers.py` | 30 passed |
| `pytest tests/test_plugin_schema.py tests/test_dw_perform_move_helpers.py` | 37 passed |
| `pytest tests/test_dw_perform_move_helpers.py tests/test_plugin_schema.py` | **2 failed**, 35 passed |

То есть тесты Dungeon World падают, когда выполняются **раньше** `test_plugin_schema.py`, который в фикстуре создаёт `CharactersManager(full_codex=FullCodex())`. Значит, состояние, от которого зависит результат, разделяется между тестами через codex, а не пересоздаётся на каждый тест.

Корневая причина внутри codex **не локализована**: модульных кешей и `lru_cache` в `plugins/pbta/**/codex` нет, явной мутации объектов ходов в `CharactersManager` тоже не видно. Так что вина не обязательно на `test_plugin_schema.py` — не исключено, что падающие тесты сами полагаются на состояние, которое кто-то инициализирует раньше.

Практический вред двойной. Во-первых, «2 failed» в базовом прогоне обесценивает весь набор: невозможно отличить свою регрессию от фонового шума. Во-вторых, любой новый тест, затрагивающий тот же codex, меняет результат чужих тестов. Это подтвердилось на практике: первая версия [test_wave1_security.py](../RPGdata/tests/test_wave1_security.py) импортировала `app.main` на уровне модуля (что загружает все плагины правил) и **сама** вызывала те же два падения; пришлось сделать импорты ленивыми, внутри тестов.

**Решение.** По порядку: (1) найти разделяемое состояние — прогнать `pytest --forked` или сравнить объект `FullCodex()` до и после создания `CharactersManager`; (2) пересоздавать codex на каждый тест через фикстуру, а не полагаться на порядок; (3) до устранения — зафиксировать в `conftest.py` (`INF-06`) изоляцию плагинного реестра, чтобы загрузка `app.main` не влияла на другие тесты.

**Исправлено.** Корневая причина оказалась не в codex, а в загрузчике плагинов: `DirPluginRegistry.load_all` чистил и переимпортировал уже загруженные модули, включая общую библиотеку типов `plugins.pbta.base.backend.types`. У всех, кто импортировал типы до этого, оставались ссылки на прежние классы, и `isinstance` через границу плагина начинал возвращать `False` — молча, без ошибки. Тесты Dungeon World при этом теряли все ресурсы хода.

Правка в двух местах. `load_all` больше не чистит модули (`purge=False`), чистка осталась только в `reload()`, где она и нужна. А `iter_move_grants` перестал полагаться на `isinstance` как на единственный путь: при несовпадении класса он читает объект через `model_dump()`, а неизвестные типы логирует вместо тихого пропуска. Полный прогон — 172 passed.

---

## Проверено и проблемой не является

Чтобы не возвращаться к этому при следующем анализе:

- **`.pnpm-store` в `.gitignore`** — присутствует и в корневом [.gitignore:32](../.gitignore), и в [RPGWebMainClient/.gitignore:29](../RPGWebMainClient/.gitignore). Артефакты в репозиторий не попадают.
- **Голова миграций одна** — цепочка от `35282f446d69_initial` до `l1m2n3o4p5q6_roll_record` линейна, ветвлений нет.
- **`migrate` как one-shot сервис** — в [compose.prod.yml:2-23](../compose.prod.yml) миграции выполняются отдельным сервисом до старта `app`, с `condition: service_completed_successfully`. Сделано правильно.
