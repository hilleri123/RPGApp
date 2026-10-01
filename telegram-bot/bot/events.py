"""Consumer of backend -> bot notification events (rpg.events / bot.notify)."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

import aio_pika
from aio_pika import ExchangeType, IncomingMessage
from aiogram import Bot
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo

from bot.config import bot_settings

logger = logging.getLogger(__name__)

EVENTS_EXCHANGE = "rpg.events"
EVENTS_QUEUE = "bot.notify"
EVENTS_ROUTING_KEY = "bot.notify"

# callback_data: "join:<session_id>" — свежая одноразовая ссылка входа по нажатию.
JOIN_CALLBACK_PREFIX = "join:"
# callback_data: "joinlobby:<lobby_id>" — то же для приглашения в лобби.
JOIN_LOBBY_CALLBACK_PREFIX = "joinlobby:"


def session_url(session_id: str) -> str:
    return f"{bot_settings.web_client_url}/session/{session_id}"


def _is_local(url: str) -> bool:
    return "://localhost" in url or "://127.0.0.1" in url


def lobby_url(lobby_id: str) -> str:
    return f"{bot_settings.web_client_url}/lobby/{lobby_id}"


def _entry_keyboard(url: str, callback_data: str) -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = []
    # Web App внутри Telegram входит по initData; Telegram принимает только https.
    if not _is_local(bot_settings.web_client_url):
        rows.append(
            [InlineKeyboardButton(text="📱 Открыть в Telegram", web_app=WebAppInfo(url=url))]
        )
    # Браузер: одноразовая ссылка с токеном выдаётся по нажатию (токен живёт 5 минут).
    rows.append(
        [
            InlineKeyboardButton(
                text="🌐 Ссылка для браузера (со входом)", callback_data=callback_data
            )
        ]
    )
    return InlineKeyboardMarkup(inline_keyboard=rows)


def render_lobby_invited(event: dict[str, Any]) -> tuple[str, InlineKeyboardMarkup]:
    lobby = (event.get("lobby_name") or "").strip()
    master = (event.get("master_name") or "").strip()
    title = f"«{lobby}»" if lobby else "лобби"
    who = f"Мастер {master}" if master else "Мастер"
    text = f"🎲 {who} приглашает вас в {title}.\nЗаходите — игра соберётся в лобби."
    lobby_id = str(event["lobby_id"])
    return text, _entry_keyboard(
        lobby_url(lobby_id), f"{JOIN_LOBBY_CALLBACK_PREFIX}{lobby_id}"
    )


def render_session_started(event: dict[str, Any]) -> tuple[str, InlineKeyboardMarkup]:
    lobby = (event.get("lobby_name") or "").strip()
    scenario = (event.get("scenario_name") or "").strip()
    title = f"«{lobby}»" if lobby else "игровая сессия"
    lines = [f"🎲 Сессия {title} началась!"]
    if scenario:
        lines.append(f"Сценарий: {scenario}")
    lines.append("Заходите — мастер уже ждёт.")

    session_id = str(event["session_id"])
    rows: list[list[InlineKeyboardButton]] = []
    # 1) Web App внутри Telegram: клиент сам входит по initData, токен не нужен.
    #    Telegram принимает для Web App только https — на localhost кнопку не показываем.
    if not _is_local(bot_settings.web_client_url):
        rows.append(
            [
                InlineKeyboardButton(
                    text="📱 Открыть в Telegram",
                    web_app=WebAppInfo(url=session_url(session_id)),
                )
            ]
        )
    # 2) Обычный браузер: одноразовая ссылка с токеном входа выдаётся по нажатию, чтобы
    #    она не протухла (токен живёт 5 минут) пока сообщение лежит в чате.
    rows.append(
        [
            InlineKeyboardButton(
                text="🌐 Ссылка для браузера (со входом)",
                callback_data=f"{JOIN_CALLBACK_PREFIX}{session_id}",
            )
        ]
    )
    return "\n".join(lines), InlineKeyboardMarkup(inline_keyboard=rows)


async def handle_event(bot: Bot, event: dict[str, Any]) -> None:
    if event.get("event") == "session_started":
        text, keyboard = render_session_started(event)
        await bot.send_message(int(event["telegram_id"]), text, reply_markup=keyboard)
        return
    if event.get("event") == "lobby_invited":
        text, keyboard = render_lobby_invited(event)
        await bot.send_message(int(event["telegram_id"]), text, reply_markup=keyboard)
        return
    logger.warning("unknown bot event: %s", event.get("event"))


async def run_events_consumer(bot: Bot) -> None:
    """Long-running task: reconnects itself, never takes the polling loop down."""
    while True:
        try:
            connection = await aio_pika.connect_robust(bot_settings.rabbit_url)
            async with connection:
                channel = await connection.channel()
                await channel.set_qos(prefetch_count=16)
                exchange = await channel.declare_exchange(
                    EVENTS_EXCHANGE, ExchangeType.DIRECT, durable=True
                )
                queue = await channel.declare_queue(EVENTS_QUEUE, durable=True)
                await queue.bind(exchange, routing_key=EVENTS_ROUTING_KEY)
                logger.info("Bot events consumer started on %s", EVENTS_QUEUE)

                async with queue.iterator() as it:
                    async for message in it:
                        await _process(bot, message)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("events consumer crashed, retrying in 5s")
            await asyncio.sleep(5)


async def _process(bot: Bot, message: IncomingMessage) -> None:
    # Не возвращаем в очередь: пользователь мог заблокировать бота, повтор не поможет.
    async with message.process(requeue=False):
        try:
            await handle_event(bot, json.loads(message.body.decode()))
        except Exception:
            logger.exception("failed to deliver bot event")
