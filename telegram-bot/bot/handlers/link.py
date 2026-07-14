from __future__ import annotations

from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message

from bot.services.link_urls import login_url_for_telegram_user

router = Router()


def _is_private(message: Message) -> bool:
    return message.chat.type == "private"


@router.message(Command("link"))
async def cmd_link(message: Message) -> None:
    from_user = message.from_user
    if from_user is None:
        await message.reply("Не удалось определить отправителя.")
        return

    if not _is_private(message):
        try:
            url = await login_url_for_telegram_user(
                telegram_id=from_user.id,
                first_name=from_user.first_name or "Игрок",
                last_name=from_user.last_name,
                username=from_user.username,
            )
            await message.bot.send_message(
                from_user.id,
                "Ссылка для входа в браузере (действует 5 минут, одноразовая):\n\n"
                f"{url}\n\n"
                "Откройте её в Chrome/Safari/Firefox — не внутри Telegram.",
            )
            await message.reply("Отправил ссылку в личные сообщения.")
        except Exception:
            await message.reply(
                "Напишите мне /link в личку — ссылка входа приходит только туда.\n"
                "Если бот молчит в ЛС, сначала нажмите /start у бота."
            )
        return

    url = await login_url_for_telegram_user(
        telegram_id=from_user.id,
        first_name=from_user.first_name or "Игрок",
        last_name=from_user.last_name,
        username=from_user.username,
    )
    await message.answer(
        "Ссылка для входа в браузере (действует 5 минут, одноразовая):\n\n"
        f"{url}\n\n"
        "Откройте её в Chrome/Safari/Firefox — не внутри Telegram."
    )
