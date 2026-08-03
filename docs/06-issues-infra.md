# Дефекты инфраструктуры

Compose, nginx, скрипты, конфигурация, тесты. Снимок на коммит `fb13687`.

## Сводка

| ID | Severity | Кратко |
|----|----------|--------|
| [INF-01](#inf-01) | high | `Makefile` и `migrate.sh` ссылаются на несуществующий `docker-compose.yml` |
| [INF-02](#inf-02) | high | nginx проксирует на порты, которых compose не публикует |
| [INF-03](#inf-03) | medium | Нет healthcheck у `app`, `web-client`, `telegram-bot` |
| [INF-04](#inf-04) | medium | Дефолтные креды RabbitMQ и порты БД наружу |
| [INF-05](#inf-05) | medium | `.env.example` расходится с тем, что читает код |
| [INF-06](#inf-06) | medium | Тесты: только unit, нет `conftest.py` и интеграционных |
| [INF-07](#inf-07) | low | Мёртвая инфраструктура: MongoDB и Kafka |
| [INF-08](#inf-08) | low | Дублирующиеся имена миграций |

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

---

### INF-03

**Нет healthcheck у `app`, `web-client`, `telegram-bot`**

**Где:** [compose.prod.yml:25-83](../compose.prod.yml), [161](../compose.prod.yml)

**Проблема.** Инфраструктурные сервисы healthcheck-и имеют: `db` (строка 101), `redis` (134), `rabbitmq` (149). У прикладных сервисов их нет.

Последствия конкретные. `web-client` объявляет `depends_on: [app]` короткой формой (строка 81-82), которая означает лишь «контейнер запущен», а не «приложение отвечает». Фронтенд стартует раньше готовности API. Docker не может перезапустить зависший процесс, потому что не знает, что тот завис: `restart: unless-stopped` срабатывает только на выход процесса, а не на потерю работоспособности.

**Решение.** Добавить healthcheck на `/health` для `app` и на корень для `web-client`, перевести `depends_on` на длинную форму с `condition: service_healthy`. Для `telegram-bot` — проверку живости соединения с RabbitMQ.

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

---

### INF-06

**Тесты: только unit, нет `conftest.py` и интеграционных**

**Где:** [RPGdata/tests/](../RPGdata/tests)

**Проблема.** 10 тестовых файлов, все — изолированные unit-тесты вокруг плагинов и вспомогательных функций: `test_action_cancel_permissions`, `test_dw_perform_move_helpers`, `test_entity_data_rule`, `test_entity_seen`, `test_move_overrides`, `test_permissions`, `test_plugin_schema`, `test_roll_kit`, `test_scenario_archive`, `test_scenario_cloner`.

`conftest.py` отсутствует, то есть общих фикстур (тестовая БД, Redis, клиент FastAPI) нет в принципе. Из этого следует, что **не покрыто ничего** из следующего:

- HTTP-эндпоинты — ни один. `BE-02` (вызов несуществующего метода) не был бы возможен при простейшем smoke-тесте всех роутов.
- Права доступа на уровне эндпоинтов — `BE-03`, `BE-10`, `BE-11` ловятся одним тестом «чужой пользователь получает 403».
- WebSocket-протокол, ролевые payload-ы.
- Взаимодействие с Redis и Postgres, включая ключевую логику `_session_key()`.
- Прогон миграций от нуля до головы.

У фронтенда тестов нет вообще.

**Решение.** По убыванию отдачи: `conftest.py` с транзакционной тестовой БД и `httpx.AsyncClient`; smoke-тест, обходящий все зарегистрированные роуты; матрица прав доступа по ролям; тест миграций `upgrade head` на чистой БД; интеграционные тесты WebSocket-сценария.

---

### INF-07

**Мёртвая инфраструктура: MongoDB и Kafka**

**Где:** [settings.py:5](../RPGdata/app/infrastructure/settings.py), [mongo.py](../RPGdata/app/infrastructure/mongo.py), [main.py:48-52](../RPGdata/app/main.py), [redis_matvei.py:8, 202](../RPGdata/app/infrastructure/redis_matvei.py), [requirements.txt:30, 43](../RPGdata/requirements.txt)

```python
# app.add_event_handler("startup", connect_to_mongo)
# app.add_event_handler("shutdown", close_mongo_connection)
```

**Проблема.** MongoDB отключена: обработчики закомментированы, `mongo.py` не импортируется ниоткуда. При этом `motor==3.1.1` и `pymongo==4.3.3` остаются в зависимостях, а `mongodb_url` — в настройках с дефолтным паролем `admin:admin`.

Похожая история с Kafka: `redis_matvei.py` создаёт продюсер с `bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS`, а переменная нигде не задаётся — значит `None`.

Это не ломает работу, но вводит в заблуждение: читающий код считает, что Mongo и Kafka — часть архитектуры, и тратит время на их изучение. Плюс лишние зависимости в образе и лишняя поверхность CVE.

**Решение.** Удалить `mongo.py`, `mongodb_url` и пакеты `motor`/`pymongo`. По Kafka — либо довести до рабочего состояния, либо убрать вместе с веткой в `redis_matvei.py`.

---

### INF-08

**Дублирующиеся имена миграций**

**Где:** [RPGdata/alembic/versions/](../RPGdata/alembic/versions)

**Проблема.** Три ревизии называются `player_character_snapshot` (`1c14e3fbcd43`, `247aef56aacb`, `73974522f0c1`) и две — `templates_to_exposures` (`8ee42590bb5e`, `c4acdad9da2a`). Ещё одна называется просто `test` (`3474aadb9af9`).

На работу это не влияет — цепочка линейна, голова одна (`l1m2n3o4p5q6_roll_record`), 25 ревизий. Но при разборе инцидента с БД одинаковые имена заставляют сверять хеши, чтобы понять, о какой миграции речь.

**Решение.** Переименовывать не стоит — идентификаторы уже в таблице `alembic_version` на проде. Достаточно договориться про осмысленные уникальные `-m` для новых миграций.

---

## Проверено и проблемой не является

Чтобы не возвращаться к этому при следующем анализе:

- **`.pnpm-store` в `.gitignore`** — присутствует и в корневом [.gitignore:32](../.gitignore), и в [RPGWebMainClient/.gitignore:29](../RPGWebMainClient/.gitignore). Артефакты в репозиторий не попадают.
- **Голова миграций одна** — цепочка от `35282f446d69_initial` до `l1m2n3o4p5q6_roll_record` линейна, ветвлений нет.
- **`migrate` как one-shot сервис** — в [compose.prod.yml:2-23](../compose.prod.yml) миграции выполняются отдельным сервисом до старта `app`, с `condition: service_completed_successfully`. Сделано правильно.
