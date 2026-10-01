"""FE-03: duplicate session WS actions are claimed exactly once."""

import pytest

import app.main  # noqa: F401  (resolves circular imports)
from app.services import ws_idempotency


class _FakeRedis:
    def __init__(self):
        self.store: dict[str, str] = {}

    async def set(self, key, value, nx=False, ex=None):
        if nx and key in self.store:
            return None
        self.store[key] = value
        return True

    async def delete(self, key):
        self.store.pop(key, None)


@pytest.fixture
def fake_redis(monkeypatch):
    fake = _FakeRedis()
    monkeypatch.setattr(ws_idempotency, "redis_client", fake)
    return fake


@pytest.mark.asyncio
async def test_first_delivery_wins_duplicate_dropped(fake_redis):
    assert await ws_idempotency.claim("s1", "u1", "m1") is True
    assert await ws_idempotency.claim("s1", "u1", "m1") is False


@pytest.mark.asyncio
async def test_claims_are_scoped_by_session_and_user(fake_redis):
    assert await ws_idempotency.claim("s1", "u1", "m1") is True
    assert await ws_idempotency.claim("s2", "u1", "m1") is True
    assert await ws_idempotency.claim("s1", "u2", "m1") is True


@pytest.mark.asyncio
async def test_release_allows_retry(fake_redis):
    assert await ws_idempotency.claim("s1", "u1", "m1") is True
    await ws_idempotency.release("s1", "u1", "m1")
    assert await ws_idempotency.claim("s1", "u1", "m1") is True


@pytest.mark.asyncio
async def test_redis_failure_does_not_block_actions(monkeypatch):
    class Broken:
        async def set(self, *a, **k):
            raise ConnectionError("down")

    monkeypatch.setattr(ws_idempotency, "redis_client", Broken())
    assert await ws_idempotency.claim("s1", "u1", "m1") is True


def test_normalize_client_msg_id():
    assert ws_idempotency.normalize_client_msg_id(" abc ") == "abc"
    assert ws_idempotency.normalize_client_msg_id("") is None
    assert ws_idempotency.normalize_client_msg_id(123) is None
    assert ws_idempotency.normalize_client_msg_id("x" * 500) is None
