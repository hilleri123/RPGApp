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
| [BE-06](#be-06) | high | `__getitem__` теряет `launched_scenario_id` — REST и WS читают разные ключи Redis |
| [BE-07](#be-07) | high | In-memory реестр менеджеров ломается при нескольких воркерах |
| [BE-08](#be-08) | high | Обсервер-эндпоинты без аутентификации |
| [BE-09](#be-09) | high | Лобби автоматически принимает любого пользователя |
| [BE-10](#be-10) | high | `config_editor` без аутентификации |
| [BE-11](#be-11) | high | IDOR в `locations.py`: правка локаций чужого сценария |
| [BE-12](#be-12) | high | CORS `*` вместе с `allow_credentials=True` |
| [BE-13](#be-13) | high | Cookies с `secure=False` |
| [BE-14](#be-14) | high · исправлено | Секретный ключ по умолчанию захардкожен |
| [BE-15](#be-15) | medium | `set_field` молча теряет запись для половины сущностей |
| [BE-16](#be-16) | medium | Гонки при параллельной отправке действий |
| [BE-17](#be-17) | medium · исправлено | `except Exception: continue` глушит ошибки персиста |
| [BE-18](#be-18) | medium | Path traversal в `s3_service.py` |
| [BE-19](#be-19) | medium | Блокирующая запись файлов в async-обработчике |
| [BE-20](#be-20) | medium | Инвертированная проверка дубликата при регистрации |
| [BE-21](#be-21) | low | Двойное переопределение времени жизни токенов |

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

---

### BE-07

**In-memory реестр менеджеров ломается при нескольких воркерах**

**Где:** [session_manager.py:29](../RPGdata/app/managers/session_manager.py) — `self.managers: dict[str, CurrentSessionManager] = {}`

**Проблема.** Реестр живёт в памяти процесса. Redis как общее состояние это частично спасает, но не полностью: кеш сущностей `_entity_cache` внутри `CurrentSessionManager` **не разделяется** между воркерами. При `uvicorn --workers N` или горизонтальном масштабировании воркеры разойдутся в представлении о сущностях, и мастер с игроком увидят разные данные.

Сейчас это не стреляет только потому, что прод запускается в один процесс — то есть система не масштабируется по определению.

**Решение.** Краткосрочно — зафиксировать «один воркер» как явное ограничение в документации и compose. Правильно — вынести инвалидацию кеша в Redis pub/sub, чтобы воркеры сбрасывали кеш согласованно.

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

---

### BE-10

**`config_editor` без аутентификации**

**Где:** [config_editor.py](../RPGdata/app/routes/rules/config_editor.py) — во всех эндпоинтах только `Depends(get_db)` (строки 78, 103, 128, 153, 173, 193, 212, 232, 252, 271, 288), ни одного `get_current_user`

**Проблема.** Роутер отдаёт схемы редакторов, значения по умолчанию и опции для **произвольного** `scenario_id` и `template_set_id`. Аноним перебором UUID вытянет структуру и справочные данные чужих сценариев.

**Решение.** Добавить `Depends(get_current_user)` во все эндпоинты и проверять доступ к сценарию. Вариант по `rule_id_str` (без привязки к сценарию) можно оставить открытым — там нет пользовательских данных.

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

---

### BE-13

**Cookies с `secure=False`**

**Где:** [matvei.py:25, 34, 142, 151](../RPGdata/app/routes/auth/matvei.py)

**Проблема.** `access_token` и `refresh_token` ставятся без флага `secure` во всех четырёх местах, то есть уходят и по обычному HTTP. С учётом `REFRESH_TOKEN_EXPIRE_DAYS` (см. `BE-21`) перехваченный токен даёт практически бессрочный доступ.

**Решение.** `secure=True` в проде через настройку, `samesite="lax"`, для дева оставить переключатель.

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

---

## Medium

### BE-15

**`set_field` молча теряет запись для половины сущностей**

**Где:** [data_manager.py:117-127](../RPGdata/app/managers/session/data_manager.py)

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

---

### BE-16

**Гонки при параллельной отправке действий**

**Где:** [action_manager.py:425](../RPGdata/app/managers/session/action_manager.py) `submit_action`, [535](../RPGdata/app/managers/session/action_manager.py) `patch_action`, [599](../RPGdata/app/managers/session/action_manager.py) `cancel_action` — все заканчиваются `_save_actions(actions)` (строка 152)

**Проблема.** Классический read-modify-write: читается весь список действий, меняется в памяти, целиком записывается обратно. Блокировок нет. Два одновременных submit-а от разных игроков — и один затирает результат другого. В `perform_move` это штатная ситуация: несколько игроков подключаются к одному ходу через `aid`.

Баг вероятностный, воспроизводится редко и выглядит как «действие пропало».

**Решение.** Распределённая блокировка на ключ сессии (`SET NX PX` в Redis) вокруг цикла чтение-запись, либо атомарный патч конкретного действия через `JSON.SET` по пути вместо перезаписи всего массива.

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

---

### BE-19

**Блокирующая запись файлов в async-обработчике**

**Где:** [s3_service.py:71, 88, 106](../RPGdata/app/infrastructure/s3_service.py) — `dest.write_bytes(content)`

**Проблема.** Синхронная запись на диск внутри `async def` блокирует event loop целиком. Загрузка карты локации на несколько мегабайт подвешивает **все** WebSocket-соединения сервера на время записи. Для приложения, где реальное время — основная механика, это заметно всем участникам сессии.

**Решение.** Обернуть в `await asyncio.to_thread(dest.write_bytes, content)` или использовать `aiofiles`. То же касается `_cleanup_old_versions` (строка 44) с обходом каталога.

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
