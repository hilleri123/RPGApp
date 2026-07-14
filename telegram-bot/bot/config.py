from __future__ import annotations

import os


class BotSettings:
    token: str = os.getenv("BOT_TOKEN", "")
    web_client_url: str = os.getenv("WEB_CLIENT_URL", "http://localhost:6602").rstrip("/")
    rabbit_url: str = os.getenv("RABBIT_URL", "amqp://rpg:rpg@rabbitmq:5672/")
    rpc_timeout_seconds: float = float(os.getenv("BOT_RPC_TIMEOUT", "10"))

    @property
    def enabled(self) -> bool:
        return bool(self.token.strip())


bot_settings = BotSettings()
