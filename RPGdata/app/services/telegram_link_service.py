"""One-time browser login tokens issued by the Telegram bot."""

from __future__ import annotations

import json
import secrets
from typing import Any

from app.infrastructure.redis_service import redis_client

TG_LINK_PREFIX = "tg_link:"
TG_LINK_TTL_SECONDS = 300


async def create_link_token(
    *,
    telegram_id: int,
    first_name: str,
    last_name: str | None = None,
    username: str | None = None,
) -> str:
    token = secrets.token_urlsafe(32)
    payload = {
        "telegram_id": telegram_id,
        "first_name": first_name,
        "last_name": last_name,
        "username": username,
    }
    await redis_client.setex(
        f"{TG_LINK_PREFIX}{token}",
        TG_LINK_TTL_SECONDS,
        json.dumps(payload),
    )
    return token


async def consume_link_token(token: str) -> dict[str, Any] | None:
    key = f"{TG_LINK_PREFIX}{token}"
    # GETDEL атомарен: два одновременных входа по одной ссылке не пройдут оба.
    raw = await redis_client.getdel(key)
    if not raw:
        return None
    if isinstance(raw, bytes):
        raw = raw.decode()
    return json.loads(raw)
