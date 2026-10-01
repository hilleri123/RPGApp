"""FE-03: server-side deduplication of session WebSocket actions.

The client stamps every action with ``client_msg_id`` and re-sends anything not yet
acknowledged after a reconnect. Without dedup a message that *did* reach the server
before the link dropped would run twice (a move rolled twice, an item given twice).

``claim`` is an atomic ``SET NX EX``: the first delivery wins, repeats are dropped and
only acknowledged. A failed/rejected first attempt releases the claim so a retry can run.
"""

from __future__ import annotations

from app.infrastructure.redis_service import redis_client

IDEMPOTENCY_PREFIX = "ws_idem:"
IDEMPOTENCY_TTL_SECONDS = 15 * 60
_MAX_ID_LEN = 128


def _key(session_id: str, user_id: object, client_msg_id: str) -> str:
    return f"{IDEMPOTENCY_PREFIX}{session_id}:{user_id}:{client_msg_id}"


def normalize_client_msg_id(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    value = value.strip()
    if not value or len(value) > _MAX_ID_LEN:
        return None
    return value


async def claim(session_id: str, user_id: object, client_msg_id: str) -> bool:
    """True if this is the first delivery of ``client_msg_id`` (caller must process it)."""
    try:
        return bool(
            await redis_client.set(
                _key(session_id, user_id, client_msg_id),
                "1",
                nx=True,
                ex=IDEMPOTENCY_TTL_SECONDS,
            )
        )
    except Exception:
        # Redis hiccup must not block gameplay: process (at-least-once, as before).
        return True


async def release(session_id: str, user_id: object, client_msg_id: str) -> None:
    try:
        await redis_client.delete(_key(session_id, user_id, client_msg_id))
    except Exception:
        pass
