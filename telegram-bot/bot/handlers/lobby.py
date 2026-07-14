from __future__ import annotations

import re
from typing import Any

from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message

from bot.rpc import rpc_client
from bot.services.link_urls import login_url_for_telegram_user

router = Router()

_CREATE_COMMANDS = {"create_lobby", "создать_лобби", "createlobby", "lobby"}
_MENTION_RE = re.compile(r"@([A-Za-z0-9_]{4,32})")
_GROUP_TYPES = {"group", "supergroup"}


def _parse_create_lobby_args(text: str | None) -> tuple[str, list[str]]:
    if not text:
        return "", []

    parts = text.strip().split(maxsplit=1)
    if len(parts) < 2:
        return "", []

    args_text = parts[1].strip()
    mentions = [m.lower() for m in _MENTION_RE.findall(args_text)]
    name = _MENTION_RE.sub("", args_text).strip()
    name = re.sub(r"\s+", " ", name)
    return name, mentions


async def _dm_login_link(
    message: Message,
    *,
    telegram_id: int,
    first_name: str,
    last_name: str | None = None,
    username: str | None = None,
    next_path: str,
    text: str,
) -> bool:
    try:
        login = await login_url_for_telegram_user(
            telegram_id=telegram_id,
            first_name=first_name,
            last_name=last_name,
            username=username,
            next_path=next_path,
        )
        await message.bot.send_message(telegram_id, f"{text}\n\n{login}")
        return True
    except Exception:
        return False


async def _handle_create_lobby(message: Message) -> None:
    if message.chat.type not in _GROUP_TYPES:
        await message.reply(
            "Эту команду нужно вызвать в группе с игроками.\n\n"
            "Пример:\n"
            "/создать_лобби Вечерняя партия @player1 @player2\n\n"
            "Каждому в личку придёт одноразовая ссылка входа сразу в это лобби."
        )
        return

    lobby_name, usernames = _parse_create_lobby_args(message.text)
    if not usernames:
        await message.reply(
            "Укажите игроков через @username.\n\n"
            "Пример:\n"
            "/создать_лобби Вечерняя партия @player1 @player2"
        )
        return

    from_user = message.from_user
    if from_user is None:
        await message.reply("Не удалось определить отправителя.")
        return

    try:
        result: dict[str, Any] = await rpc_client.call(
            "create_lobby",
            {
                "master_telegram_id": from_user.id,
                "lobby_name": lobby_name,
                "tg_usernames": usernames,
            },
        )
    except Exception as exc:
        await message.reply(f"Не удалось создать лобби: {exc}")
        return

    if result.get("error"):
        await message.reply(str(result["error"]))
        return

    lobby = result.get("lobby") or {}
    lobby_id = lobby.get("id")
    lobby_title = lobby.get("name") or "Лобби"
    if not lobby_id:
        await message.reply("Бэкенд не вернул id лобби.")
        return

    lobby_path = f"/lobby/{lobby_id}"
    invited = list(result.get("invited") or [])
    not_found = list(result.get("not_found") or [])
    skipped_master = list(result.get("skipped_master") or [])

    lines = [
        f"✅ Лобби «{lobby_title}» создано.",
        "Ссылки для входа отправил в личные сообщения (мастер и игроки).",
    ]

    if invited:
        invited_labels = [
            f"@{u['tg']}" if u.get("tg") else (u.get("full_name") or str(u.get("id")))
            for u in invited
        ]
        lines.append(f"Приглашены: {', '.join(invited_labels)}")
    else:
        lines.append("Игроки не добавлены — проверьте @username.")

    if not_found:
        lines.append(
            "Не найдены в приложении: " + ", ".join(f"@{u}" for u in not_found)
        )

    if skipped_master:
        lines.append(
            "Пропущен ваш username (мастер уже в лобби): "
            + ", ".join(f"@{u}" for u in skipped_master)
        )

    master_name = (
        from_user.full_name
        or (f"@{from_user.username}" if from_user.username else None)
        or "Мастер"
    )

    master_ok = await _dm_login_link(
        message,
        telegram_id=from_user.id,
        first_name=from_user.first_name or "Мастер",
        last_name=from_user.last_name,
        username=from_user.username,
        next_path=lobby_path,
        text=(
            f"🎲 Лобби «{lobby_title}» создано.\n"
            "Одноразовая ссылка входа (откройте в браузере, не в Telegram):"
        ),
    )
    if not master_ok:
        lines.append(
            "Не удалось написать вам в ЛС. Напишите боту /start в личку и повторите."
        )

    notified = 0
    failed = 0
    for user in invited:
        telegram_id = user.get("telegram_id")
        if not telegram_id:
            failed += 1
            continue
        ok = await _dm_login_link(
            message,
            telegram_id=int(telegram_id),
            first_name=user.get("full_name") or "Игрок",
            username=user.get("tg"),
            next_path=lobby_path,
            text=(
                f"🎲 Мастер {master_name} приглашает в лобби «{lobby_title}».\n"
                "Одноразовая ссылка входа (откройте в браузере, не в Telegram):"
            ),
        )
        if ok:
            notified += 1
        else:
            failed += 1

    if notified:
        lines.append(f"Личные уведомления игрокам: {notified}.")
    if failed:
        lines.append(
            f"Не удалось написать в ЛС: {failed}. "
            "Игрок должен хотя бы раз написать боту /start."
        )

    await message.reply("\n".join(lines))


@router.message(Command(*_CREATE_COMMANDS))
async def cmd_create_lobby(message: Message) -> None:
    await _handle_create_lobby(message)
