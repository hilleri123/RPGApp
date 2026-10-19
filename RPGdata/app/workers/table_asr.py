"""Воркер: очередь table.asr и запасной обход ещё не сданных сегментов."""

from __future__ import annotations

import asyncio
import json
import logging
from uuid import UUID

from app.infrastructure.rabbitmq import TABLE_ASR_QUEUE, connect
from app.services.table_asr import pending_segment_ids, transcribe_segment

logger = logging.getLogger(__name__)


async def _sweep() -> None:
    while True:
        try:
            for segment_id in await pending_segment_ids():
                await transcribe_segment(segment_id)
        except Exception:
            logger.exception("table asr sweep failed")
        await asyncio.sleep(20)


async def _consume() -> None:
    while True:
        try:
            channel = await connect()
            queue = await channel.declare_queue(TABLE_ASR_QUEUE, durable=True)

            async def handle(message) -> None:
                async with message.process():
                    body = json.loads(message.body.decode())
                    await transcribe_segment(UUID(str(body["segment_id"])))

            await queue.consume(handle)
            await asyncio.Future()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("table asr consumer reconnects")
            await asyncio.sleep(5)


async def main() -> None:
    sweep = asyncio.create_task(_sweep())
    try:
        await _consume()
    finally:
        sweep.cancel()


if __name__ == "__main__":
    asyncio.run(main())
