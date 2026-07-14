"""Entry point: python -m bot.main"""

from __future__ import annotations

import asyncio
import logging

from aiogram import Bot, Dispatcher, Router
from aiogram.filters import CommandStart
from aiogram.types import BotCommand, Message

from bot.config import bot_settings
from bot.handlers import setup_routers
from bot.rpc import rpc_client

logger = logging.getLogger(__name__)


async def _set_commands(bot: Bot) -> None:
    # Telegram BotCommand names: only a-z, 0-9, underscore (no Cyrillic).
    await bot.set_my_commands(
        [
            BotCommand(command="start", description="Приветствие и инструкция"),
            BotCommand(command="link", description="Вход в браузере"),
            BotCommand(command="create_lobby", description="Создать лобби для игроков"),
        ]
    )


async def main() -> None:
    logging.basicConfig(level=logging.INFO)

    if not bot_settings.enabled:
        raise RuntimeError("BOT_TOKEN is not set")

    await rpc_client.connect()

    bot = Bot(token=bot_settings.token)
    dp = Dispatcher()
    dp.include_router(setup_routers())

    start_router = Router()

    @start_router.message(CommandStart())
    async def cmd_start(message: Message) -> None:
        await message.answer(
            "Привет! Я бот НРИ.\n\n"
            "• /link — в личке: одноразовая ссылка входа в браузере\n"
            "• /создать_лобби Название @player1 @player2 — в группе: "
            "создать лобби и прислать всем входные ссылки в личку\n\n"
            "Ссылки открывайте в обычном браузере (не внутри Telegram)."
        )

    dp.include_router(start_router)

    await _set_commands(bot)
    logger.info("Telegram bot polling started")
    try:
        await dp.start_polling(bot)
    finally:
        await rpc_client.close()
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
