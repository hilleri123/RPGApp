"""aio-pika RPC client for backend.bot.rpc."""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from typing import Any

import aio_pika
from aio_pika import ExchangeType, IncomingMessage, Message
from aio_pika.abc import AbstractChannel, AbstractRobustConnection

from bot.config import bot_settings

logger = logging.getLogger(__name__)

RPC_EXCHANGE = "rpg.rpc"
RPC_ROUTING_KEY = "bot.rpc"


class BotRpcClient:
    def __init__(self) -> None:
        self._connection: AbstractRobustConnection | None = None
        self._channel: AbstractChannel | None = None
        self._exchange = None
        self._callback_queue = None
        self._futures: dict[str, asyncio.Future[dict[str, Any]]] = {}
        self._ready = asyncio.Event()

    async def connect(self) -> None:
        self._connection = await aio_pika.connect_robust(bot_settings.rabbit_url)
        self._channel = await self._connection.channel()
        self._exchange = await self._channel.declare_exchange(
            RPC_EXCHANGE, ExchangeType.DIRECT, durable=True
        )
        self._callback_queue = await self._channel.declare_queue(exclusive=True)
        await self._callback_queue.consume(self._on_response, no_ack=True)
        self._ready.set()
        logger.info("Bot RPC client connected to %s", bot_settings.rabbit_url)

    async def close(self) -> None:
        self._ready.clear()
        for fut in self._futures.values():
            if not fut.done():
                fut.set_exception(ConnectionError("RPC client closed"))
        self._futures.clear()
        if self._channel and not self._channel.is_closed:
            await self._channel.close()
        if self._connection and not self._connection.is_closed:
            await self._connection.close()

    async def _on_response(self, message: IncomingMessage) -> None:
        correlation_id = message.correlation_id
        if not correlation_id or correlation_id not in self._futures:
            return
        fut = self._futures.pop(correlation_id)
        if fut.done():
            return
        try:
            payload = json.loads(message.body.decode())
        except Exception as exc:
            fut.set_exception(exc)
            return
        fut.set_result(payload)

    async def call(self, method: str, params: dict[str, Any] | None = None) -> Any:
        await self._ready.wait()
        assert self._channel and self._exchange and self._callback_queue

        req_id = str(uuid.uuid4())
        correlation_id = str(uuid.uuid4())
        loop = asyncio.get_running_loop()
        fut: asyncio.Future[dict[str, Any]] = loop.create_future()
        self._futures[correlation_id] = fut

        body = json.dumps(
            {"id": req_id, "method": method, "params": params or {}}
        ).encode()
        await self._exchange.publish(
            Message(
                body=body,
                correlation_id=correlation_id,
                reply_to=self._callback_queue.name,
                content_type="application/json",
                expiration=int(bot_settings.rpc_timeout_seconds * 1000),
            ),
            routing_key=RPC_ROUTING_KEY,
        )

        try:
            response = await asyncio.wait_for(
                fut, timeout=bot_settings.rpc_timeout_seconds
            )
        except asyncio.TimeoutError:
            self._futures.pop(correlation_id, None)
            raise TimeoutError(f"RPC timeout: {method}") from None

        if response.get("error"):
            err = response["error"]
            message = err.get("message") if isinstance(err, dict) else str(err)
            raise RuntimeError(message or f"RPC error: {method}")

        return response.get("result")


rpc_client = BotRpcClient()
