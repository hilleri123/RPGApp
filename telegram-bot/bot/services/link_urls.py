from __future__ import annotations

from urllib.parse import quote

from bot.config import bot_settings
from bot.rpc import rpc_client


def login_url(token: str, *, next_path: str | None = None) -> str:
    base = f"{bot_settings.web_client_url}/auth/link?token={token}"
    if next_path:
        return f"{base}&next={quote(next_path, safe='')}"
    return base


async def login_url_for_telegram_user(
    *,
    telegram_id: int,
    first_name: str,
    last_name: str | None = None,
    username: str | None = None,
    next_path: str | None = None,
) -> str:
    result = await rpc_client.call(
        "create_link_token",
        {
            "telegram_id": telegram_id,
            "first_name": first_name,
            "last_name": last_name,
            "username": username,
        },
    )
    token = result["token"]
    return login_url(token, next_path=next_path)
