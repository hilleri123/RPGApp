from __future__ import annotations

import logging

from aiogram import F, Router
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup

from bot.events import JOIN_CALLBACK_PREFIX, JOIN_LOBBY_CALLBACK_PREFIX
from bot.services.link_urls import login_url_for_telegram_user

logger = logging.getLogger(__name__)
router = Router()


async def _send_login_link(callback: CallbackQuery, *, next_path: str, what: str) -> None:
    user = callback.from_user
    try:
        url = await login_url_for_telegram_user(
            telegram_id=user.id,
            first_name=user.first_name or "Игрок",
            last_name=user.last_name,
            username=user.username,
            next_path=next_path,
        )
    except Exception:
        logger.exception("join link failed")
        await callback.answer("Не удалось получить ссылку, попробуйте /link", show_alert=True)
        return

    await callback.answer()
    if callback.message is None:
        return
    text = (
        f"Ссылка для браузера: войдёт в аккаунт и сразу откроет {what} (действует 5 минут, одноразовая).\n"
        "Откройте её в обычном браузере, не внутри Telegram."
    )
    if "://localhost" in url or "://127.0.0.1" in url:
        # url-кнопки на localhost Telegram не принимает — отдаём ссылку текстом.
        await callback.message.answer(f"{text}\n\n{url}")
        return
    await callback.message.answer(
        text,
        reply_markup=InlineKeyboardMarkup(
            inline_keyboard=[[InlineKeyboardButton(text="🌐 Открыть в браузере", url=url)]]
        ),
    )


@router.callback_query(F.data.startswith(JOIN_CALLBACK_PREFIX))
async def on_join(callback: CallbackQuery) -> None:
    session_id = (callback.data or "")[len(JOIN_CALLBACK_PREFIX):]
    await _send_login_link(callback, next_path=f"/session/{session_id}", what="сессию")


@router.callback_query(F.data.startswith(JOIN_LOBBY_CALLBACK_PREFIX))
async def on_join_lobby(callback: CallbackQuery) -> None:
    lobby_id = (callback.data or "")[len(JOIN_LOBBY_CALLBACK_PREFIX):]
    await _send_login_link(callback, next_path=f"/lobby/{lobby_id}", what="лобби")
