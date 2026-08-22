"""RabbitMQ connection helpers and Telegram-bot RPC consumer."""

from __future__ import annotations

import json
import logging
import os
from typing import Any

import aio_pika
from aio_pika import ExchangeType, IncomingMessage, Message
from aio_pika.abc import AbstractChannel, AbstractConnection, AbstractRobustConnection

logger = logging.getLogger(__name__)

RABBIT_URL = os.getenv("RABBIT_URL", "amqp://rpg:rpg@rabbitmq:5672/")
RPC_EXCHANGE = "rpg.rpc"
RPC_QUEUE = "backend.bot.rpc"
RPC_ROUTING_KEY = "bot.rpc"

_connection: AbstractRobustConnection | AbstractConnection | None = None
_channel: AbstractChannel | None = None
_consumer_queue = None
_consumer_tag: str | None = None


async def connect(retries: int = 10, delay_sec: float = 1.5) -> AbstractChannel:
    global _connection, _channel
    if _channel and not _channel.is_closed:
        return _channel

    import asyncio

    last_err: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            _connection = await aio_pika.connect_robust(RABBIT_URL)
            _channel = await _connection.channel()
            await _channel.set_qos(prefetch_count=16)
            if attempt > 1:
                logger.info("RabbitMQ connected on attempt %s", attempt)
            return _channel
        except Exception as exc:
            last_err = exc
            logger.warning(
                "RabbitMQ connect failed (attempt %s/%s): %s",
                attempt,
                retries,
                exc,
            )
            await asyncio.sleep(delay_sec)

    raise RuntimeError(f"RabbitMQ unavailable after {retries} attempts") from last_err


async def close() -> None:
    global _connection, _channel, _consumer_tag
    _consumer_tag = None
    if _channel and not _channel.is_closed:
        await _channel.close()
    _channel = None
    if _connection and not _connection.is_closed:
        await _connection.close()
    _connection = None


async def _dispatch(method: str, params: dict[str, Any]) -> Any:
    if method == "create_link_token":
        from app.services.telegram_link_service import create_link_token

        token = await create_link_token(
            telegram_id=int(params["telegram_id"]),
            first_name=str(params.get("first_name") or "Игрок"),
            last_name=params.get("last_name"),
            username=params.get("username"),
        )
        return {"token": token}

    if method == "create_lobby":
        from app.services.bot_lobby_service import create_lobby_from_bot_dict

        return await create_lobby_from_bot_dict(
            master_telegram_id=int(params["master_telegram_id"]),
            lobby_name=str(params.get("lobby_name") or ""),
            tg_usernames=list(params.get("tg_usernames") or []),
            master_username=params.get("master_username"),
        )

    raise ValueError(f"unknown method: {method}")


async def _on_rpc_message(message: IncomingMessage) -> None:
    async with message.process(requeue=False):
        reply_to = message.reply_to
        correlation_id = message.correlation_id
        req_id = None
        try:
            payload = json.loads(message.body.decode())
            req_id = payload.get("id")
            method = payload.get("method")
            params = payload.get("params") or {}
            if not method:
                raise ValueError("method required")
            result = await _dispatch(str(method), dict(params))
            response: dict[str, Any] = {"id": req_id, "result": result}
        except Exception as exc:
            logger.exception("bot RPC failed")
            response = {
                "id": req_id,
                "error": {"code": "rpc_error", "message": str(exc)},
            }

        if not reply_to or _channel is None or _channel.is_closed:
            return

        await _channel.default_exchange.publish(
            Message(
                body=json.dumps(response, default=str).encode(),
                correlation_id=correlation_id,
                content_type="application/json",
            ),
            routing_key=reply_to,
        )


async def start_bot_rpc_consumer() -> None:
    """Declare topology and start consuming RPC requests from the Telegram bot."""
    global _consumer_tag, _consumer_queue
    channel = await connect()
    exchange = await channel.declare_exchange(
        RPC_EXCHANGE, ExchangeType.DIRECT, durable=True
    )
    queue = await channel.declare_queue(RPC_QUEUE, durable=True)
    _consumer_queue = queue
    await queue.bind(exchange, routing_key=RPC_ROUTING_KEY)
    _consumer_tag = await queue.consume(_on_rpc_message)
    logger.info(
        "Bot RPC consumer started on %s / %s (rk=%s)",
        RPC_EXCHANGE,
        RPC_QUEUE,
        RPC_ROUTING_KEY,
    )


async def stop_bot_rpc_consumer() -> None:
    global _consumer_tag, _consumer_queue
    if _consumer_queue and _consumer_tag:
        try:
            await _consumer_queue.cancel(_consumer_tag)
        except Exception:
            logger.exception("failed to cancel bot RPC consumer")
    _consumer_tag = None
    _consumer_queue = None
    await close()
