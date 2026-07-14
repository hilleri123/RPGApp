from __future__ import annotations

import os


def _resolve_web_client_url() -> str:
    """Публичный URL фронта для magic-link (не API, не localhost по умолчанию в prod)."""
    raw = os.getenv("WEB_CLIENT_URL", "").strip().rstrip("/")
    if raw:
        return raw
    api = os.getenv("NEXT_PUBLIC_API_URL", "").strip().rstrip("/")
    if api.endswith("/api"):
        base = api[:-4].rstrip("/")
        if base:
            return base
    return "http://localhost:6602"


class BotSettings:
    token: str = os.getenv("BOT_TOKEN", "")
    web_client_url: str = _resolve_web_client_url()
    rabbit_url: str = os.getenv("RABBIT_URL", "amqp://rpg:rpg@rabbitmq:5672/")
    rpc_timeout_seconds: float = float(os.getenv("BOT_RPC_TIMEOUT", "10"))

    @property
    def enabled(self) -> bool:
        return bool(self.token.strip())


bot_settings = BotSettings()
