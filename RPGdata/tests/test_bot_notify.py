"""Telegram «session started» notification: event shape and fan-out."""

import uuid

import pytest

import app.main  # noqa: F401  (resolves circular imports)
from app.services import bot_notify_service as svc


def test_event_shape():
    sid = uuid.uuid4()
    ev = svc.build_session_started_event(
        telegram_id=42, session_id=sid, lobby_name="Вечер", scenario_name="Тень"
    )
    assert ev["event"] == "session_started"
    assert ev["telegram_id"] == 42
    assert ev["next_path"] == f"/session/{sid}"


@pytest.mark.asyncio
async def test_publishes_once_per_linked_user(monkeypatch):
    published = []

    async def fake_publish(event):
        published.append(event)

    async def fake_ids(user_ids):
        return [1, 2]

    import app.infrastructure.rabbitmq as rmq

    monkeypatch.setattr(rmq, "publish_bot_event", fake_publish)
    monkeypatch.setattr(svc, "_telegram_ids", fake_ids)

    sent = await svc.notify_session_started(
        session_id=uuid.uuid4(), user_ids=[uuid.uuid4()], lobby_name="L"
    )
    assert sent == 2
    assert [e["telegram_id"] for e in published] == [1, 2]


@pytest.mark.asyncio
async def test_rabbit_failure_never_raises(monkeypatch):
    async def boom(event):
        raise ConnectionError("rabbit down")

    async def fake_ids(user_ids):
        return [1]

    import app.infrastructure.rabbitmq as rmq

    monkeypatch.setattr(rmq, "publish_bot_event", boom)
    monkeypatch.setattr(svc, "_telegram_ids", fake_ids)

    assert await svc.notify_session_started(
        session_id=uuid.uuid4(), user_ids=[uuid.uuid4()], lobby_name="L"
    ) == 0
