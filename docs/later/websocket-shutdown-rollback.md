# WebSocket при остановке приложения роняет rollback сессии

Статус: не чинили. Заметили 2026-10-13 около 18:53 МСК в логах `rpgapp-app-1`.

## Что видно в логе

Сразу после `uvicorn.error: Shutting down` и `connection closed` падает живой WebSocket:

```text
Exception in ASGI application
asyncpg.exceptions._base.InterfaceError: cannot call Transaction.rollback(): the underlying connection is closed
sqlalchemy.exc.InterfaceError: ... cannot call Transaction.rollback(): the underlying connection is closed
```

Стек идёт из `uvicorn/protocols/websockets/websockets_impl.py` в выход из `get_async_session` (`RPGdata/app/infrastructure/database.py`, `async with AsyncSessionLocal()`). SQLAlchemy закрывает сессию и пытается сделать `rollback`, а соединение asyncpg уже закрыто.

## Почему это не отдельный запрос пользователя

Это хвост остановки процесса, а не ошибка конкретной ручки. Пока uvicorn ждёт фоновые задачи, открытый сокет ещё держит сессию БД. К этому моменту пул или само соединение уже закрыты, поэтому `rollback` некуда отправлять. В логе это выглядит как 500, хотя запрос уже некому обслуживать.

Сессия на всё время сокета берётся через `Depends(get_db)`:

- `RPGdata/app/routes/websocket/session.py`
- `RPGdata/app/routes/websocket/lobby.py`

## Что сделать потом

При остановке не вызывать `rollback` по уже мёртвому соединению. Варианты: закрывать сессию сокета до dispose движка или глушить `InterfaceError` именно на выходе из `get_async_session` во время shutdown. Обычные HTTP-запросы этот след не воспроизводят.
