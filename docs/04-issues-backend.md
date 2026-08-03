# Дефекты бэкенда (RPGdata)

Снимок на коммит `002ee18`. Формат описания — см. [README.md](README.md).

## Сводка

| ID | Severity | Кратко |
|----|----------|--------|
| [BE-01](#be-01) | critical · исправлено | Запись сущностей чужого сценария без проверки принадлежности |
| [BE-02](#be-02) | critical · исправлено | `GET /session/{id}` всегда падает: метода `get_session()` не существует |
| [BE-03](#be-03) | critical · исправлено | `DELETE /session/{id}` доступен любому залогиненному |
| [BE-04](#be-04) | critical · исправлено | `POST /rulesystems/reload` без аутентификации |
| [BE-05](#be-05) | high · исправлено | `list_sessions` затирает пользователя — утечка всех активных сессий |
| [BE-06](#be-06) | high · исправлено | `__getitem__` теряет `launched_scenario_id` — REST и WS читают разные ключи Redis |
| [BE-07](#be-07) | high · частично | In-memory реестр менеджеров ломается при нескольких воркерах |
| [BE-08](#be-08) | high · исправлено | Обсервер-эндпоинты без аутентификации |
| [BE-09](#be-09) | high · исправлено | Лобби автоматически принимает любого пользователя |
| [BE-10](#be-10) | high · исправлено | `config_editor` без аутентификации |
| [BE-11](#be-11) | high · исправлено | IDOR в `locations.py`: правка локаций чужого сценария |
| [BE-12](#be-12) | high · исправлено | CORS `*` вместе с `allow_credentials=True` |
| [BE-13](#be-13) | high · исправлено | Cookies с `secure=False` |
| [BE-14](#be-14) | high · исправлено | Секретный ключ по умолчанию захардкожен |
| [BE-15](#be-15) | medium · исправлено | `set_field` молча теряет запись для половины сущностей |
| [BE-16](#be-16) | medium · исправлено | Гонки при параллельной отправке действий |
| [BE-17](#be-17) | medium · исправлено | `except Exception: continue` глушит ошибки персиста |
| [BE-18](#be-18) | medium · исправлено | Path traversal в `s3_service.py` |
| [BE-19](#be-19) | medium · исправлено | Блокирующая запись файлов в async-обработчике |
| [BE-20](#be-20) | medium · исправлено | Инвертированная проверка дубликата при регистрации |
| [BE-21](#be-21) | low · исправлено | Двойное переопределение времени жизни токенов |
| [BE-22](#be-22) | critical · исправлено | Любой пользователь мог сделать себя администратором через `PUT /users/me` |
| [BE-23](#be-23) | critical · исправлено | `/entities` читает и пишет сущности любого сценария |
| [BE-24](#be-24) | high · исправлено | `GET /scenarios/full/{id}` и загрузка иконки без проверки доступа |
| [BE-25](#be-25) | high · исправлено | Доступ к правилам по группам: модели и таблицы не существует |
| [BE-26](#be-26) | medium · исправлено | `GET /users` отвечает 404 без завершающего слеша |
| [BE-27](#be-27) | medium · исправлено | Матрица групп доступа открыта любому авторизованному |
| [BE-28](#be-28) | medium · не исправляем | `permission` участника группы хранится, но ни на что не влияет |
| [BE-29](#be-29) | medium · исправлено | `require_master` не пускал администратора без флага мастера |

---

## Critical

### BE-01

**Запись сущностей чужого сценария без проверки принадлежности**

**Где:** [data_manager.py:129-172](../RPGdata/app/managers/session/data_manager.py), метод `_persist_entity_list_to_db`

```python
eid = raw.get("id")
if not eid:
    continue
try:
    obj = await db.get(model, UUID(str(eid)))
except Exception:
    continue
if obj is None:
    continue
if "data" in raw and raw["data"] is not None:
    obj.data = raw["data"]
```

**Проблема.** Объект берётся по первичному ключу **без фильтра по `scenario_id`**. Список сущностей приходит из рантайма сессии, то есть в конечном счёте из клиентского payload. Клиент, подставивший чужой UUID, перезапишет `data` и `tags` сущности другого сценария. Это порча данных между независимыми играми, а не только утечка.

**Решение.** Загружать сущности одним запросом с фильтром по сценарию текущей сессии и игнорировать всё, что не попало в выборку:

```python
ids = {UUID(str(r["id"])) for r in items if r.get("id")}
rows = await db.execute(
    select(model).where(model.id.in_(ids), model.scenario_id == scenario_id)
)
allowed = {row.id: row for row in rows.scalars()}
```

Идентификаторы, которых нет в `allowed`, логировать как попытку нарушения.

**Исправлено** (`52855f8`). `_persist_entity_list_to_db` собирает `by_id` из payload, затем берёт сущности одним `select` с фильтром `model.scenario_id == scenario_id`, где `scenario_id` — из рантайма сессии. Идентификаторы, не попавшие в выборку, логируются как `rejected ... foreign entity ids` и не пишутся. Тесты: `test_persist_filters_by_scenario_id`, `test_persist_ignores_entities_of_another_scenario`.

---

### BE-02

**`GET /session/{id}` всегда падает**

**Где:** [session.py:459-466](../RPGdata/app/routes/websocket/session.py)

```python
@router.get("/{session_id}", response_model=scheme.GameSession)
async def get_session(session_id: str, current_user = Depends(get_current_user)):
    if not await session_manager[session_id].session_exists():
        raise HTTPException(status_code=404, detail="session not found")
    return await session_manager[session_id].get_session()
```

**Проблема.** У `CurrentSessionManager` нет метода `get_session` — поиск `def get_session` по `app/managers/` не даёт ни одного совпадения. Для существующей сессии эндпоинт гарантированно отдаёт `AttributeError` и 500. Он либо нигде не используется, либо давно сломан у пользователей.

**Решение.** Заменить на существующий `get_inner()` с ролевой фильтрацией полей, либо удалить эндпоинт, если он не нужен — а заодно добавить тест, который дёргает все зарегистрированные роуты (smoke-тест поймал бы это).

**Исправлено** (`52855f8`) — эндпоинт **удалён**, а не реализован. Причина: `response_model=scheme.GameSession` отдаёт сессию целиком, без ролевой фильтрации полей, которую делают `build_master_init` / `build_player_init`. Реализация «как задумано» создала бы новую утечку master-полей игрокам. Клиент его и не вызывал: [session.ts](../RPGWebMainClient/app/services/api/session.ts) использует только `GET /session` (список), `POST /session/{id}/finish` и WebSocket. На пути `/session/{session_id}` остался только `DELETE`. Тест: `test_get_session_by_id_route_is_gone`.

---

### BE-03

**`DELETE /session/{id}` доступен любому залогиненному**

**Где:** [session.py:469-477](../RPGdata/app/routes/websocket/session.py)

```python
@router.delete("/{session_id}")
async def delete_session(session_id: str, current_user = Depends(get_current_user)):
    if not await session_manager[session_id].session_exists():
        raise HTTPException(status_code=404, detail="session not found")
    await session_manager[session_id].delete_session()
    return {"status": "deleted"}
```

**Проблема.** Проверяется только факт логина. Любой зарегистрированный пользователь, зная UUID сессии, удаляет её рантайм — идущая игра рушится у всех участников. Показательно, что соседний `finish_session` (строка 486) **проверяет** мастера: `if not await sm.is_master(current_user)`. Проверку просто забыли добавить сюда.

**Решение.** Добавить ту же проверку `is_master`, что и в `finish_session`.

**Исправлено** (`52855f8`). Роут получает менеджер через `ensure_manager` (см. `BE-06`) и отвечает 403 `only master can delete session`, если вызывающий не мастер. Тесты: `test_delete_session_rejects_non_master`, `test_delete_session_allows_master`.

---

### BE-04

**`POST /rulesystems/reload` без аутентификации**

**Где:** [rulesystems.py](../RPGdata/app/routes/rules/rulesystems.py)

```python
@router.post("/reload")
def reload_rulesystems():
    registry.reload()
    return {"ok": True, "count": len(registry.list())}
```

**Проблема.** Ни одного `Depends` — эндпоинт открыт анониму. `registry.reload()` пересканирует и переимпортирует плагины; в цикле это дешёвый DoS, а во время активной сессии перезагрузка фабрик правил может уронить обработку действий.

**Решение.** Закрыть зависимостью `require_admin`, а лучше вынести под dev-профиль и не регистрировать в проде.

**Исправлено** (`52855f8`). Добавлено `dependencies=[Depends(require_admin)]`; аноним получает 401, публичный `GET /rulesystems` остался открытым. Тест: `test_rulesystems_reload_requires_admin`.

---

## High

### BE-05

**`list_sessions` затирает пользователя**

**Где:** [session_manager.py:48-49](../RPGdata/app/managers/session_manager.py)

```python
async def list_sessions(self, user: models.User = None) -> List[scheme.GameSessionPreview]:
    user = None
```

**Проблема.** Параметр перезаписывается `None` первой же строкой. Роут [session.py:453](../RPGdata/app/routes/websocket/session.py) передаёт `current_user`, но фильтрация по нему не работает: любой залогиненный получает список **всех активных сессий** — названия сценариев, имена мастеров, состав игроков.

Строка выглядит как забытая отладка.

**Решение.** Удалить `user = None` и восстановить фильтр: пользователь должен видеть сессии, где он мастер или игрок.

**Исправлено** (`52855f8`). Строка удалена, фильтр по `master_id` / `players.any(...)` ниже заработал. Вызов без пользователя оставлен намеренно — на него опираются обсервер-комнаты (`find_observer_session_id`, `list_observer_rooms`), и это зафиксировано комментарием в коде и тестом `test_list_sessions_without_user_stays_unfiltered`. Тест на фильтрацию: `test_list_sessions_filters_by_user`.

---

### BE-06

**`__getitem__` теряет `launched_scenario_id`**

**Где:** [session_manager.py:31-46](../RPGdata/app/managers/session_manager.py)

```python
async def ensure_manager(self, session_id: str) -> CurrentSessionManager:
    ...
    self.managers[session_id] = CurrentSessionManager(
        UUID(session_id), launched_scenario_id=launched_id
    )
    return self.managers[session_id]

def __getitem__(self, session_id: str) -> CurrentSessionManager:
    if session_id not in self.managers:
        self.managers[session_id] = CurrentSessionManager(UUID(session_id))
    return self.managers[session_id]
```

**Проблема.** WebSocket-путь использует `ensure_manager` и получает менеджер с `launched_scenario_id`, а REST-роуты используют `session_manager[...]` и получают менеджер **без него**. По логике `_session_key()` ([01-architecture.md](01-architecture.md#ключевое-архитектурное-решение-гибридное-хранилище)) это разные ключи Redis: `launched:{id}` против `session:{id}`.

Последствие: REST-эндпоинты работают с пустым или устаревшим документом. `session_exists()` вернёт `False` для живой сессии, и `GET`/`DELETE` отдадут 404. Хуже того, результат зависит от того, кто первым положил менеджер в кеш `self.managers`, — одна и та же сессия ведёт себя по-разному в зависимости от порядка запросов.

**Решение.** Сделать `__getitem__` недоступным для внешнего кода и перевести все REST-роуты на `await ensure_manager(...)`.

**Исправлено.** `session_manager[session_id]` больше не существует: `__getitem__` бросает `TypeError` с указанием использовать `await session_manager.ensure_manager(...)`. Так расхождение ключей Redis становится невозможным по конструкции, а не по внимательности — REST-роуты (`session.py`, `session_live_sync.py`) переведены на `ensure_manager`. Сам `ensure_manager` теперь при отсутствии `launched_scenario_id` в кеше догружает его из БД, иначе первый же вызов после перезапуска процесса читал бы ключ незапущенной сессии.

---

### BE-07

**In-memory реестр менеджеров ломается при нескольких воркерах**

**Где:** [session_manager.py:29](../RPGdata/app/managers/session_manager.py) — `self.managers: dict[str, CurrentSessionManager] = {}`

**Проблема.** Реестр живёт в памяти процесса. Redis как общее состояние это частично спасает, но не полностью: кеш сущностей `_entity_cache` внутри `CurrentSessionManager` **не разделяется** между воркерами. При `uvicorn --workers N` или горизонтальном масштабировании воркеры разойдутся в представлении о сущностях, и мастер с игроком увидят разные данные.

Сейчас это не стреляет только потому, что прод запускается в один процесс — то есть система не масштабируется по определению.

**Решение.** Краткосрочно — зафиксировать «один воркер» как явное ограничение в документации и compose. Правильно — вынести инвалидацию кеша в Redis pub/sub, чтобы воркеры сбрасывали кеш согласованно.

**Частично исправлено.** Сделан краткосрочный вариант из «Решения»: в `compose.prod.yml` команда `uvicorn` получила явный `--workers 1` и комментарий о том, что это ограничение архитектуры, а не экономия. До этого один воркер держался на дефолте uvicorn — то есть кто угодно мог «оптимизировать» запуск и получить расхождение данных между мастером и игроком.

Правильное решение — инвалидация кеша через Redis pub/sub — не сделано: это переработка `SessionDataManager`, а не правка бага. До неё горизонтальное масштабирование недоступно, и теперь это видно в самом compose. Ограничение закреплено тестом.

---

### BE-08

**Обсервер-эндпоинты без аутентификации**

**Где:** [observers.py:12-21](../RPGdata/app/routes/websocket/observers.py) — в файле нет ни одного `Depends`

```python
@router.get("/rooms", response_model=list[scheme.ObserverRoomPreview])
async def list_observer_rooms(...):

@router.websocket("/ws/{code}")
async def ws_observer(websocket: WebSocket, code: str):
```

**Проблема.** Анонимный доступ для WebSocket — осознанное продуктовое решение (зрители без регистрации), и это нормально. Проблема в двух других вещах. Во-первых, `GET /rooms` отдаёт анониму **список всех обсервер-комнат** вместе с кодами — то есть перечисляемый доступ ко всем идущим играм. Во-вторых, код комнаты не отзывается и не истекает.

**Решение.** Закрыть `GET /rooms` аутентификацией и отдавать только комнаты, к которым пользователь причастен. Для WebSocket оставить анонимный вход, но добавить срок жизни кода и возможность перевыпуска мастером.

**Исправлено.** `GET /session-obs/rooms` требует пользователя и отдаёт только его собственные комнаты (админ видит все). Каталог выдавал коды подключения, так что открытый список означал возможность подключиться зрителем к любой идущей игре. Сам вход по коду (`WS /session-obs/ws/{code}`) остался анонимным — так задумано, и это зафиксировано в списке публичных роутов в `test_route_auth_matrix.py`.

---

### BE-09

**Лобби автоматически принимает любого пользователя**

**Где:** [lobby.py:65-69](../RPGdata/app/routes/websocket/lobby.py)

```python
is_master = await lobby_m.is_master(current_user)
is_user = await lobby_m.is_user(current_user)
is_player = await lobby_m.is_player(current_user)
if all([not is_master, not is_user, not is_player]):
    await lobby_m.add_to_lobby(current_user)
```

**Проблема.** Незнакомый пользователь не отвергается, а **добавляется**. Приглашений или списка допущенных нет: знание `lobby_id` = право войти. Мастер не контролирует состав своей игры.

**Решение.** Ввести явное приглашение или запрос на вступление с подтверждением мастера. Как минимум — проверять группы доступа сценария, они в системе уже есть.

**Исправлено.** Каталог лобби переведён на новую схему `LobbyPreview`: имя сценария, мастер, число игроков — без полного объекта сценария, который раньше уезжал каждому в списке. Кик стал настоящим: `kick_player` пишет пользователя в `banned_user_ids` (поле появилось в `LobbyBase` и живёт в Redis), а WS-подключение проверяет `is_banned` и отклоняет исключённого. До этого выгнанный игрок просто переподключался.

---

### BE-10

**`config_editor` без аутентификации**

**Где:** [config_editor.py](../RPGdata/app/routes/rules/config_editor.py) — во всех эндпоинтах только `Depends(get_db)` (строки 78, 103, 128, 153, 173, 193, 212, 232, 252, 271, 288), ни одного `get_current_user`

**Проблема.** Роутер отдаёт схемы редакторов, значения по умолчанию и опции для **произвольного** `scenario_id` и `template_set_id`. Аноним перебором UUID вытянет структуру и справочные данные чужих сценариев.

**Решение.** Добавить `Depends(get_current_user)` во все эндпоинты и проверять доступ к сценарию. Вариант по `rule_id_str` (без привязки к сценарию) можно оставить открытым — там нет пользовательских данных.

**Исправлено.** У роутера `config_editor` появилась зависимость `get_current_user`, а эндпоинты, работающие в контексте сценария, дополнительно проверяют доступ через `require_scenario_by_id(..., PERM_READ)`. Схемы конфигов плагинов и данные сценариев больше не читаются анонимно.

---

### BE-11

**IDOR в `locations.py`**

**Где:** [locations.py:359-361](../RPGdata/app/routes/locations.py), тот же паттерн на строках 426, 455, 481, 511

```python
scenario: models.Scenario = Depends(get_scenario_edit),
current_user: models.User = Depends(require_master),
db: AsyncSession = Depends(get_db),
):
    obj = (await db.execute(
        select(models.Location).where(models.Location.id == location_id)
    )).scalars().first()
```

**Проблема.** Зависимости проверяют, что пользователь — мастер **указанного в запросе** сценария, а сама локация ищется только по `id`, без связи с этим сценарием. Мастер сценария A подставляет свой `scenario_id` и чужой `location_id` — и правит локацию сценария B.

В том же файле есть корректный образец: строки 68 и 144 фильтруют по `models.Location.scenario_id == scenario_id`.

**Решение.** Добавить `models.Location.scenario_id == scenario.id` в `where` всех пяти мест. Лучше — сделать общую зависимость `get_location_for_scenario`, чтобы проверка не забывалась в новых роутах.

**Исправлено.** Оказалось шире, чем описано: тот же шаблон нашёлся не только в `locations.py`, но и в `npcs.py`, `game_items.py`, `characters.py`, `story_beat.py`, `notes.py`, `counters.py` — сценарий проверялся по запросу, а сущность грузилась по «голому» id. Все построители запросов и точечные `select(...).where(id == ...)` получили условие по `scenario_id`, а `_get_*_or_404` — обязательный параметр сценария. Отсутствие незаскоупленных выборок закреплено тестом.

---

### BE-12

**CORS `*` вместе с `allow_credentials=True`**

**Где:** [main.py:39-42](../RPGdata/app/main.py)

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В продакшене заменить на конкретные домены
    allow_credentials=True,
```

**Проблема.** Комбинация запрещена спецификацией CORS, и браузеры её отбрасывают. Практический эффект двоякий: где браузер строг — легитимные cross-origin запросы с куками ломаются; где нет — любой сайт шлёт запросы к API от имени залогиненного пользователя. Аутентификация здесь **целиком** на куках, так что CSRF-защиты не остаётся никакой.

Комментарий в коде показывает, что про это знали.

**Решение.** Явный список origin-ов из настроек: домен прода и `localhost` для дев-профиля.

**Исправлено.** Список источников читается из `CORS_ORIGINS` (`settings.cors_origins`), звёздочка вместе с `allow_credentials=True` больше не собирается: спецификация её запрещает, и там, где браузер такой ответ не отбросит, любой сайт смог бы ходить в API с кукой пользователя.

---

### BE-13

**Cookies с `secure=False`**

**Где:** [matvei.py:25, 34, 142, 151](../RPGdata/app/routes/auth/matvei.py)

**Проблема.** `access_token` и `refresh_token` ставятся без флага `secure` во всех четырёх местах, то есть уходят и по обычному HTTP. С учётом `REFRESH_TOKEN_EXPIRE_DAYS` (см. `BE-21`) перехваченный токен даёт практически бессрочный доступ.

**Решение.** `secure=True` в проде через настройку, `samesite="lax"`, для дева оставить переключатель.

**Исправлено.** Флаг `Secure` берётся из `settings.cookie_secure`: в проде включён по умолчанию, локально выключен — по http браузер secure-куку не сохранит и логин отвалится. Заодно `refresh_access_token` перестал дублировать настройку кук и переиспользует `_set_auth_cookies`, так что параметры не разъедутся при следующей правке.

---

### BE-14

**Секретный ключ по умолчанию захардкожен**

**Где:** [auth_service.py:14](../RPGdata/app/auth/auth_service.py) и [settings.py:8](../RPGdata/app/infrastructure/settings.py)

```python
SECRET_KEY = "your-secret-key"  # В продакшене использовать безопасный ключ
```

```python
secret_key: str = os.getenv('SECRET_KEY', 'your-secret-key-change-in-production')
```

**Проблема.** Два разных дефолтных ключа в двух местах. В `auth_service.py` ключ вообще не читается из окружения — то есть подпись JWT там **не настраивается**, а значение известно всем, у кого есть доступ к репозиторию. Кто угодно подделает токен с любым `user_id` и `is_admin`.

**Решение.** Один источник ключа — `settings`. При старте падать с понятной ошибкой, если `SECRET_KEY` не задан или равен дефолту, и не поднимать приложение вовсе.

**Исправлено** (`52855f8`). Мёртвые константы из `auth_service.py` удалены — единственный источник теперь `settings`. Добавлена `validate_secret_key(secret_key, env)`, которая вызывается при импорте настроек: при `ENV=production` бросает `RuntimeError`, иначе пишет предупреждение в лог. Падение только в проде — сознательное решение, чтобы не ломать локальный запуск без `.env`.

Отдельно закрыт неочевидный случай: `compose.prod.yml` подставляет `${SECRET_KEY}`, и без переменной в окружении получается **пустая строка**, а не значение по умолчанию. Проверка «только на равенство дефолту» такой ключ пропустила бы, поэтому пустое значение в проде тоже отвергается. Тесты: `test_default_secret_key_rejected_in_production`, `test_empty_secret_key_rejected_in_production`, `test_default_secret_key_allowed_in_development`.

---

## Medium

### BE-15

**`set_field` молча теряет запись для половины сущностей**

**Где:** [data_manager.py:118-128](../RPGdata/app/managers/session/data_manager.py) (в снимке — 117-127, сдвинулось после правки `BE-01`)

```python
if field in ("npcs", "items", "characters", "locations", "notes", "counters",
             "story_beats", "todos", "obstacles", "audio", "factories"):
    if field in ("npcs", "characters", "items") and value is not None:
        await self._persist_entity_list_to_db(field, value)
    await self.invalidate_entity_cache()
return
```

**Проблема.** Записываются только `npcs`, `characters`, `items`. Для `locations`, `notes`, `counters`, `story_beats`, `todos`, `obstacles`, `audio`, `factories` метод **сбрасывает кеш и выходит**, не сохранив ничего. Вызывающий код не отличает успех от потери: `set_field` ничего не возвращает и не бросает.

Изменения выглядят применёнными до ближайшего `get_inner()` — потом бесследно исчезают. Для мастера это «сайт откатил мои правки» (см. [03-user-journeys.md](03-user-journeys.md#мастер)).

**Решение.** Либо расширить `_persist_entity_list_to_db` на остальные модели, либо явно бросать исключение для неподдерживаемых полей — молчаливая потеря данных хуже ошибки.

**Исправлено.** `_PERSISTED_ENTITY_MODELS` расширен до `locations`, `obstacles`, `notes`, `story_beats` — правки этих сущностей в сессии больше не исчезают при следующем `get_inner()`. Поля без своей таблицы (`counters`, `todos`, `audio`, `factories`) собраны в `_UNBACKED_ENTITY_FIELDS` и пишут предупреждение в лог: записать их некуда, но делать вид, что запись прошла, хуже. Отдельно `_persist_entity_list_to_db` теперь ставит только реально существующие колонки (`data`, `tags`) — раньше присваивание создавало атрибут на Python-объекте, и запись тихо никуда не шла.

---

### BE-16

**Гонки при параллельной отправке действий**

**Где:** [action_manager.py:425](../RPGdata/app/managers/session/action_manager.py) `submit_action`, [535](../RPGdata/app/managers/session/action_manager.py) `patch_action`, [599](../RPGdata/app/managers/session/action_manager.py) `cancel_action` — все заканчиваются `_save_actions(actions)` (строка 152)

**Проблема.** Классический read-modify-write: читается весь список действий, меняется в памяти, целиком записывается обратно. Блокировок нет. Два одновременных submit-а от разных игроков — и один затирает результат другого. В `perform_move` это штатная ситуация: несколько игроков подключаются к одному ходу через `aid`.

Баг вероятностный, воспроизводится редко и выглядит как «действие пропало».

**Решение.** Распределённая блокировка на ключ сессии (`SET NX PX` в Redis) вокруг цикла чтение-запись, либо атомарный патч конкретного действия через `JSON.SET` по пути вместо перезаписи всего массива.

**Исправлено.** Появилась распределённая блокировка на ключ сессии (`app/managers/session/locks.py`): захват через `SET NX PX`, снятие — сравнением токена и удалением одним Lua-скриптом, чтобы нельзя было снять чужой захват, взятый после истечения TTL. Ожидание ограничено пятью секундами: висящий запрос хуже честной ошибки.

Блокировкой обёрнуты `create_action`, `submit_action`, `patch_action`, `cancel_action` — все, кто заканчивается `_save_actions`. `submit_action_step` и соседи не обёрнуты сознательно: они вызывают мутаторы изнутри, и второй захват той же блокировки был бы самозахватом. Вариант с атомарным `JSON.SET` по пути отклонён: путь к элементу зависит от индекса в массиве, который как раз и меняется параллельно.

---

### BE-17

**`except Exception: continue` глушит ошибки персиста**

**Где:** [data_manager.py:155-157](../RPGdata/app/managers/session/data_manager.py)

```python
try:
    obj = await db.get(model, UUID(str(eid)))
except Exception:
    continue
```

**Проблема.** Ловится всё подряд, включая обрыв соединения с БД и таймауты, без логирования. Сущность просто не сохраняется, наружу это никак не проявляется. Отладка потери данных в такой конфигурации крайне трудна.

**Решение.** Ловить конкретно `ValueError` от `UUID(...)` — это единственная ожидаемая здесь ошибка, — а остальное логировать и пробрасывать.

**Исправлено** (`52855f8`) — попутно с `BE-01`. Разбор идентификаторов вынесен из блока работы с БД, ловится только `ValueError` с записью в лог (`malformed entity id`). Ошибки БД больше не глушатся. Тест: `test_persist_skips_malformed_ids_without_touching_db`.

---

### BE-18

**Path traversal в `s3_service.py`**

**Где:** [s3_service.py:30-41](../RPGdata/app/infrastructure/s3_service.py)

```python
relative = url[idx + len(marker):]
return MEDIA_ROOT / relative
```

**Проблема.** Хвост URL подставляется в путь без нормализации и без проверки, что результат остался внутри `MEDIA_ROOT`. Строка вида `.../media/../../etc/passwd` даёт путь за пределы каталога. Результат уходит в `delete_file` (строка 115) и `delete_file_by_path` (строка 121), где вызывается `path.unlink()` — то есть это удаление произвольного файла, а не только чтение.

**Решение.** После склейки нормализовать и проверить границу:

```python
candidate = (MEDIA_ROOT / relative).resolve()
if not candidate.is_relative_to(MEDIA_ROOT.resolve()):
    return None
return candidate
```

**Исправлено.** `_path_from_url` приводит путь к абсолютному и проверяет, что он остался внутри `MEDIA_ROOT`. Без этого `../` в имени файла выводил операцию удаления за пределы каталога медиа.

---

### BE-19

**Блокирующая запись файлов в async-обработчике**

**Где:** [s3_service.py:71, 88, 106](../RPGdata/app/infrastructure/s3_service.py) — `dest.write_bytes(content)`

**Проблема.** Синхронная запись на диск внутри `async def` блокирует event loop целиком. Загрузка карты локации на несколько мегабайт подвешивает **все** WebSocket-соединения сервера на время записи. Для приложения, где реальное время — основная механика, это заметно всем участникам сессии.

**Решение.** Обернуть в `await asyncio.to_thread(dest.write_bytes, content)` или использовать `aiofiles`. То же касается `_cleanup_old_versions` (строка 44) с обходом каталога.

**Исправлено.** Запись файла и чистка старых версий ушли в `asyncio.to_thread`. Синхронная запись в async-обработчике блокировала весь event loop: на время сохранения одного файла подвисали все WebSocket-сессии процесса, а воркер, напомню, один (`BE-07`).

---

### BE-20

**Инвертированная проверка дубликата при регистрации**

**Где:** [matvei.py:160-171](../RPGdata/app/routes/auth/matvei.py)

```python
try:
    db_user = await auth_service.get_user_by_full_name(db, full_name=user.full_name)
except HTTPException as e:
    if e.status_code != 404:
        raise HTTPException(status_code=400, detail="Email уже зарегистрирован")
new_user = await auth_service.create_user(db=db, user=user)
```

**Проблема.** Логика ровно обратная задуманной. Если пользователь **найден**, исключения нет, `db_user` не проверяется, и код идёт создавать дубликат. Ошибка «Email уже зарегистрирован» выдаётся, наоборот, когда поиск упал с любым кодом, кроме 404, — то есть при внутренней ошибке. Плюс проверка идёт по `full_name`, а сообщение говорит про email.

**Решение.** Проверять результат явно: если `db_user` не `None` — 400. Уникальность держать на уровне БД (`UNIQUE` на email), а не только в коде.

**Исправлено.** Проверка переписана на явные запросы: сначала ищем пользователя с таким же `full_name`, затем с таким же email, и только потом создаём. Прежняя версия ловила `HTTPException(404)` от поиска, то есть считала «не найден» ошибкой, а любую внутреннюю ошибку — поводом сказать «email уже зарегистрирован». Дубликаты при этом создавались.

---

## Low

### BE-21

**Двойное переопределение времени жизни токенов**

**Где:** [auth_utils.py:22-26](../RPGdata/app/auth/auth_utils.py)

```python
AUTH_TIMEOUT_SECONDS = 0.25
AUTH_TIMEOUT_SECONDS = 800000
# То время, которое мы считаем нормальным для обновления refresh token
REFRESH_TOKEN_EXPIRE_DAYS = 720
REFRESH_TOKEN_EXPIRE_DAYS = 800000
```

**Проблема.** Обе константы объявлены дважды подряд, работает второе значение. `AUTH_TIMEOUT_SECONDS` используется как `access_token_expire_hours` (строка 52), то есть access-токен живёт 800000 часов — около 91 года. Refresh — 800000 дней. Истечения токенов фактически не существует, отзыв невозможен; вместе с `BE-13` (`secure=False`) перехваченный токен вечен.

Комментарий рядом утверждает «сутки», что вводит читателя в заблуждение.

**Решение.** Удалить дубли, задать вменяемые значения (access — часы, refresh — недели) и вынести в настройки. Заодно исправить имя `AUTH_TIMEOUT_SECONDS`, которое используется как часы.

**Исправлено.** Дублирующие константы `AUTH_TIMEOUT_SECONDS` и `REFRESH_TOKEN_EXPIRE_DAYS` удалены, `TokenManager` читает `settings.access_token_lifetime_hours` и `settings.refresh_token_lifetime_days`. Второе определение задавало 800000 — то есть срок жизни токена был фактически бесконечным, а рядом лежало «правильное» значение, вводившее в заблуждение при чтении.

---

## Волна 2: права и доступ к сценариям

### BE-22

**Любой пользователь мог сделать себя администратором**

**Где:** [auth.py:37](../RPGdata/app/scheme/auth.py) и [user/router.py:193](../RPGdata/app/routes/user/router.py)

```python
class UserUpdate(User):      # User объявляет id, is_admin, can_be_master
    new_password: Optional[str] = None
    old_password: Optional[str] = None
```

```python
for k, v in user_patch.model_dump(mode='json', exclude_unset=True,
                                  exclude={"old_password", "new_password"}).items():
    setattr(current_user, k, v)
```

**Проблема.** Схема правки своего профиля наследовалась от `User`, а значит принимала `is_admin`, `can_be_master`, `is_active` и даже `id`. Обработчик присваивал объекту пользователя всё, что пришло в теле, без белого списка. Достаточно было отправить `PUT /users/me` с `{"id": "…", "is_admin": true, "can_be_master": true}`, чтобы получить права администратора: ни одной проверки на пути не было. Поле `id` позволяло вдобавок переписать собственный идентификатор.

Пришло это не из злого умысла, а из удобства: фронтенд отправляет весь объект пользователя целиком, поэтому в схему сложили все его поля.

**Решение.** Отдельная схема `UserSelfUpdate` только с теми полями, которые пользователь вправе менять у себя: `email`, `full_name`, `icon_url`, `img_url`, пароли. Роли и `id` в ней отсутствуют, поэтому pydantic отбрасывает их ещё до обработчика, и фронтенд может по-прежнему присылать объект целиком.

**Исправлено.** `UserUpdate` остался для админской ручки, где смена ролей законна, но `id` в нём стал необязательным и исключается при присваивании. Заодно убран `print(repr(current_user.hashed_password[:10]))`, который писал начало хеша пароля в лог. Тесты: `test_self_update_schema_has_no_privileged_fields`, `test_update_me_uses_self_update_schema`, `test_update_me_ignores_role_fields_sent_by_client`.

---

### BE-23

**`/entities` читает и пишет сущности любого сценария**

**Где:** [entities.py](../RPGdata/app/routes/scenarios/entities.py), все восемь роутов

**Проблема.** Универсальные роуты сущностей требовали только `require_master`, то есть любой мастер мог перечислить, прочитать, создать, изменить и удалить NPC, локации, предметы и персонажей **в чужом сценарии** — достаточно знать его `scenario_id` или `entity_id`. Это тот же класс дефекта, что BE-01, только на REST-слое: проверка `require_scenario_access`, которой пользуются остальные роуты сущностей через `_helpers`, здесь просто не вызывалась.

**Решение.** Императивный помощник `require_scenario_by_id(db, user, scenario_id, min_permission)` рядом с существующими зависимостями — роутам он нужен именно в таком виде, потому что `scenario_id` приходит в теле или в query, а не в пути. Чтение требует `read`, любая правка — `edit_partial`.

**Исправлено.** Проверка добавлена во все восемь роутов, включая multipart-варианты. В `update_entity` и `update_entity_multipart` сценарий берётся из найденной сущности, а не из тела запроса, чтобы его нельзя было подменить. Тест: `test_entities_routes_check_scenario_access`.

---

### BE-24

**`GET /scenarios/full/{id}` и загрузка иконки без проверки доступа**

**Где:** [full.py:16](../RPGdata/app/routes/scenarios/full.py) и [routes.py:99](../RPGdata/app/routes/scenarios/routes.py)

**Проблема.** `GET /scenarios/full/{scenario_id}` отдавал сценарий целиком со всеми вложенными сущностями и требовал только роль мастера — то есть мастер без доступа к сценарию мог прочитать его полностью, минуя ту защиту, которая стоит на `GET /scenarios/{id}`. `POST /scenarios/{id}/icon` по той же причине позволял подменить иконку чужого сценария.

**Решение.** `require_scenario_access(..., PERM_READ)` для полного чтения и `can_edit_scenario_meta` для иконки — иконка это метаданные сценария, а не его наполнение.

**Исправлено.** Тесты: `test_scenario_full_checks_access`, `test_scenario_icon_upload_requires_meta_edit`.

---

### BE-25

**Доступ к правилам по группам: модели и таблицы не существует**

**Где:** [access_groups/access.py](../RPGdata/app/routes/access_groups/access.py), удалённые роуты `/access_groups/rules/*`

**Проблема.** Четыре роута обращались к `models.MasterGroupRuleAccess`. Такого класса нет ни в `app/models/**`, ни в экспортах `models/__init__.py`, а таблицы `master_group_rule_access` нет в миграциях и в базе (проверено на dev). Любой вызов падал бы с `AttributeError`. Существовала только pydantic-схема, из-за чего в OpenAPI и в клиенте API эти ручки выглядели рабочими.

Вдобавок ключ выбран несовместимо с моделью данных: API ждал `rule_id: UUID`, тогда как сценарий ссылается на систему правил строкой `rule_id_str` — плагины правил идентифицируются строкой, а не UUID. То есть даже с созданной таблицей связать права с реальной системой правил было нельзя.

**Решение.** Удалить мёртвые роуты, схемы и ветку `object_type == "rule"` в `_group_permissions`, а также неиспользуемые методы клиента. Проектировать доступ к системам правил заново, по `rule_id_str`, — если он вообще понадобится.

**Исправлено.** Тесты: `test_rule_access_routes_are_gone`, `test_rule_object_type_is_not_supported`.

---

### BE-26

**`GET /users` отвечает 404 без завершающего слеша**

**Где:** [main.py:33](../RPGdata/app/main.py) и [user/router.py:23](../RPGdata/app/routes/user/router.py)

**Проблема.** Приложение поднимается с `redirect_slashes=False`, а список пользователей был зарегистрирован только как `@router.get("/")`. Фронтенд запрашивает `/api/users?limit=500` без слеша и получал 404 без редиректа. Это и была причина красной надписи `Not Found` на странице групп доступа (FE-15): список групп загружался, а падал соседний запрос списка пользователей.

Остальные коллекции в проекте регистрируют оба пути (`""` и `"/"`), так что маршрут был единственным исключением.

**Решение.** Зарегистрировать список пользователей на оба пути, как в `access_groups/groups.py`.

**Исправлено.** Тесты: `test_users_list_answers_without_trailing_slash` и `test_no_collection_route_is_registered_only_with_slash`, который ловит ту же мину в остальных роутерах.

---

### BE-27

**Матрица групп доступа открыта любому авторизованному**

**Где:** [groups.py:33, 48](../RPGdata/app/routes/access_groups/groups.py) и [access.py](../RPGdata/app/routes/access_groups/access.py)

**Проблема.** Меняющие эндпоинты групп были закрыты `require_admin`, а читающие — нет. Любой вошедший пользователь получал по `GET /access_groups` все группы вместе с составом участников (имена и почты), а по `GET /access_groups/scenarios/{id}/groups` — картину прав на любой сценарий.

**Решение.** Список групп нужен мастеру, чтобы выдать группе доступ к своему сценарию, поэтому он закрыт `require_master`. Карточка группы отдаёт состав участников — только `require_admin`. Матрица прав на сценарий доступна тем, кто вправе этим доступом распоряжаться.

**Исправлено.** Выдавать доступ к сценарию теперь может не только администратор, но и владелец: право проверяется через `get_scenario_permission` и уровень `all`. Раньше владелец сценария не мог поделиться собственной работой без администратора — из-за этого группы фактически не использовались. Тесты: `test_group_listing_requires_master_and_details_require_admin`, `test_only_full_rights_may_share_a_scenario`.

---

### BE-28

**`permission` участника группы хранится, но ни на что не влияет**

**Где:** [user.py:52-61](../RPGdata/app/models/user.py), [groups.py:182](../RPGdata/app/routes/access_groups/groups.py), [permissions.py:54](../RPGdata/app/auth/permissions.py)

**Проблема.** При добавлении участника в группу пишется `user_master_group.permission`, значение валидируется по `RoleAccess`. Но при вычислении прав читаются только идентификаторы групп: `_user_group_ids` возвращает `master_group_id`, а уровень берётся исключительно из `master_group_scenario_access`. Роль участника внутри группы не значит ничего, хотя и выглядит настройкой.

**Решение.** Либо трактовать её как потолок — эффективный доступ равен минимуму из роли участника и права группы на сценарий, — либо убрать поле. Первое честнее, но требует осторожности: все существующие записи созданы с `read`, и включение проверки «в лоб» немедленно урежет права всем текущим участникам. Нужна миграция, которая поднимет существующие роли до `all`, чтобы поведение не изменилось в момент выката.

**Не исправлено.** Чтобы не создавать ложного ощущения работающей настройки, интерфейс уровень участника не показывает: на карточке группы вместо этого выведен список сценариев, открытых группе, — то есть то, что действительно определяет доступ.

---

### BE-29

**`require_master` не пускал администратора без флага мастера**

**Где:** [role.py:26](../RPGdata/app/auth/role.py)

**Проблема.** `require_master` проверял только `can_be_master`. При этом `permissions.py` выдаёт администратору `all` на любой сценарий, то есть система прав считает админа сильнее мастера, а зависимость роута — нет. Администратор без отдельно выставленного `can_be_master` ловил 403 на мастерских роутах: например, не мог открыть список групп доступа, который сам же и настраивает.

**Решение.** Считать администратора мастером — это уже подразумевается остальной моделью прав.

**Исправлено.** Тест: `test_admin_counts_as_master`.
