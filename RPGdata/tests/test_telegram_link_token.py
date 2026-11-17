"""Одноразовая ссылка входа из Telegram: токен даёт ровно один вход."""

from __future__ import annotations

import pytest

import app.main  # noqa: F401  (resolves circular imports)
from app.services import telegram_link_service


class _FakeRedis:
    def __init__(self) -> None:
        self.store: dict[str, str] = {}

    async def setex(self, key, ttl, value):
        self.store[key] = value

    async def getdel(self, key):
        return self.store.pop(key, None)


@pytest.fixture
def fake_redis(monkeypatch):
    fake = _FakeRedis()
    monkeypatch.setattr(telegram_link_service, "redis_client", fake)
    return fake


@pytest.mark.asyncio
async def test_token_is_consumed_once(fake_redis):
    token = await telegram_link_service.create_link_token(
        telegram_id=42, first_name="Ann", username="ann"
    )

    payload = await telegram_link_service.consume_link_token(token)
    assert payload is not None
    assert payload["telegram_id"] == 42
    assert payload["username"] == "ann"

    assert await telegram_link_service.consume_link_token(token) is None


@pytest.mark.asyncio
async def test_unknown_token_is_rejected(fake_redis):
    assert await telegram_link_service.consume_link_token("nope") is None
