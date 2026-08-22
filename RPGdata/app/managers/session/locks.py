"""Блокировка на запись в сессию (BE-16).

Список действий хранится в Redis одним JSON-массивом, а `submit_action`,
`patch_action` и `cancel_action` работают по схеме read-modify-write: читают
весь список, меняют элемент в памяти, пишут массив целиком. Два одновременных
submit-а от разных игроков в один ход (`perform_move` — штатный случай) дают
потерянную запись: последний записавший затирает соседа.

Блокировка захватывается через `SET NX PX` — атомарно и с TTL, чтобы упавший
воркер не оставил сессию заблокированной навсегда. Снимается только собственный
захват: сравнение токена и удаление выполняются одним скриптом, иначе можно
снять чужую блокировку, взятую после истечения TTL.
"""

from __future__ import annotations

import asyncio
import time
from contextlib import asynccontextmanager
from uuid import uuid4

from app.infrastructure.redis_service import redis_client
from app.logger import logger

# TTL с запасом на обработку хода плагином: она идёт в процессе, без сетевых
# вызовов, и укладывается в единицы миллисекунд.
LOCK_TTL_MS = 10_000
LOCK_WAIT_SECONDS = 5.0
_POLL_INTERVAL = 0.02

_RELEASE_IF_MINE = """
if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('del', KEYS[1])
end
return 0
"""


class SessionLockTimeout(RuntimeError):
    """Захватить блокировку за отведённое время не удалось."""


@asynccontextmanager
async def session_write_lock(
    session_key: str,
    *,
    ttl_ms: int = LOCK_TTL_MS,
    wait_seconds: float = LOCK_WAIT_SECONDS,
):
    lock_key = f"lock:{session_key}"
    token = uuid4().hex
    deadline = time.monotonic() + wait_seconds

    while not await redis_client.set(lock_key, token, nx=True, px=ttl_ms):
        if time.monotonic() >= deadline:
            raise SessionLockTimeout(f"session write lock is busy: {session_key}")
        await asyncio.sleep(_POLL_INTERVAL)

    try:
        yield
    finally:
        try:
            await redis_client.eval(_RELEASE_IF_MINE, 1, lock_key, token)
        except Exception:
            # Блокировка всё равно истечёт по TTL — ронять из-за этого запрос,
            # который уже отработал, смысла нет.
            logger.exception("не удалось снять блокировку %s", lock_key)
