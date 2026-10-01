"""Telegram notifications published to the bot over RabbitMQ (fire-and-forget)."""

from __future__ import annotations

import asyncio
import logging
from typing import Iterable
from uuid import UUID

from sqlalchemy import select

from app import models
from app.infrastructure.database import get_async_session as get_db

logger = logging.getLogger(__name__)


async def _telegram_ids(user_ids: Iterable[UUID]) -> list[int]:
    ids = list({u for u in user_ids if u})
    if not ids:
        return []
    async for db in get_db():
        rows = await db.execute(
            select(models.User.telegram_id).where(
                models.User.id.in_(ids), models.User.telegram_id.is_not(None)
            )
        )
        return [int(t) for t in rows.scalars().all()]
    return []


def build_session_started_event(
    *, telegram_id: int, session_id: UUID | str, lobby_name: str, scenario_name: str | None
) -> dict:
    return {
        "event": "session_started",
        "telegram_id": telegram_id,
        "session_id": str(session_id),
        "lobby_name": lobby_name,
        "scenario_name": scenario_name,
        "next_path": f"/session/{session_id}",
    }


async def notify_session_started(
    *,
    session_id: UUID | str,
    user_ids: Iterable[UUID],
    lobby_name: str,
    scenario_name: str | None = None,
) -> int:
    """Tell linked Telegram users the session began. Never raises; returns sent count."""
    try:
        from app.infrastructure.rabbitmq import publish_bot_event

        telegram_ids = await _telegram_ids(user_ids)
        for tg_id in telegram_ids:
            await publish_bot_event(
                build_session_started_event(
                    telegram_id=tg_id,
                    session_id=session_id,
                    lobby_name=lobby_name,
                    scenario_name=scenario_name,
                )
            )
        return len(telegram_ids)
    except Exception:
        logger.exception("failed to publish session_started notification")
        return 0


def schedule_session_started(**kwargs) -> None:
    """Run notify in the background so session start latency is unaffected."""
    task = asyncio.create_task(notify_session_started(**kwargs))
    task.add_done_callback(lambda t: t.exception() if not t.cancelled() else None)


def build_lobby_invited_event(
    *, telegram_id: int, lobby_id: UUID | str, lobby_name: str, master_name: str | None
) -> dict:
    return {
        "event": "lobby_invited",
        "telegram_id": telegram_id,
        "lobby_id": str(lobby_id),
        "lobby_name": lobby_name,
        "master_name": master_name,
        "next_path": f"/lobby/{lobby_id}",
    }


async def notify_lobby_invited(
    *,
    lobby_id: UUID | str,
    user_ids: Iterable[UUID],
    lobby_name: str,
    master_name: str | None = None,
) -> int:
    """Send a lobby invite (with a fresh token-bearing link on tap) to linked Telegram users.

    Never raises; returns how many events were published.
    """
    try:
        from app.infrastructure.rabbitmq import publish_bot_event

        telegram_ids = await _telegram_ids(user_ids)
        for tg_id in telegram_ids:
            await publish_bot_event(
                build_lobby_invited_event(
                    telegram_id=tg_id,
                    lobby_id=lobby_id,
                    lobby_name=lobby_name,
                    master_name=master_name,
                )
            )
        return len(telegram_ids)
    except Exception:
        logger.exception("failed to publish lobby_invited notification")
        return 0


def schedule_lobby_invited(**kwargs) -> None:
    task = asyncio.create_task(notify_lobby_invited(**kwargs))
    task.add_done_callback(lambda t: t.exception() if not t.cancelled() else None)
