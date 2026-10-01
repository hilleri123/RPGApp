"""Lobby creation invoked by the Telegram bot via RabbitMQ RPC."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import func, select

from app import models, scheme
from app.infrastructure.database import AsyncSessionLocal
from app.managers.lobby_manager import manager as lobby_manager
from app.services.bot_notify_service import notify_lobby_invited


@dataclass
class CreateLobbyFromBotResult:
    lobby: scheme.Lobby | None = None
    invited: list[models.User] = field(default_factory=list)
    not_found: list[str] = field(default_factory=list)
    skipped_master: list[str] = field(default_factory=list)
    error: str | None = None
    notified: int = 0


def _normalize_tg(value: str) -> str:
    return value.lstrip("@").strip().lower()


async def _find_master(
    telegram_id: int,
    username: str | None = None,
) -> models.User | None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(models.User).where(models.User.telegram_id == telegram_id)
        )
        user = result.scalars().first()
        if user:
            return user

        if not username:
            return None

        result = await db.execute(
            select(models.User).where(func.lower(models.User.tg) == _normalize_tg(username))
        )
        user = result.scalars().first()
        if user is None:
            return None

        if user.telegram_id is None:
            user.telegram_id = telegram_id
            await db.commit()
            await db.refresh(user)
            return user

        if user.telegram_id == telegram_id:
            return user

        return None


async def _find_users_by_tg_usernames(usernames: list[str]) -> dict[str, models.User]:
    normalized = [_normalize_tg(u) for u in usernames if u.strip()]
    if not normalized:
        return {}

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(models.User).where(func.lower(models.User.tg).in_(normalized))
        )
        users = result.scalars().all()

    by_tg: dict[str, models.User] = {}
    for user in users:
        if user.tg:
            by_tg[_normalize_tg(user.tg)] = user
    return by_tg


def _user_public(user: models.User) -> dict[str, Any]:
    return {
        "id": str(user.id),
        "telegram_id": user.telegram_id,
        "tg": user.tg,
        "full_name": user.full_name,
    }


def _lobby_public(lobby: scheme.Lobby) -> dict[str, Any]:
    return {
        "id": str(lobby.id),
        "name": lobby.name,
    }


def result_to_dict(result: CreateLobbyFromBotResult) -> dict[str, Any]:
    return {
        "error": result.error,
        "lobby": _lobby_public(result.lobby) if result.lobby else None,
        "invited": [_user_public(u) for u in result.invited],
        "not_found": list(result.not_found),
        "skipped_master": list(result.skipped_master),
        "notified": result.notified,
    }


async def create_lobby_from_bot(
    *,
    master_telegram_id: int,
    lobby_name: str,
    tg_usernames: list[str],
    master_username: str | None = None,
) -> CreateLobbyFromBotResult:
    master = await _find_master(master_telegram_id, master_username)
    if master is None:
        return CreateLobbyFromBotResult(
            error="Вы не зарегистрированы в приложении. Сначала войдите через /link в личке бота.",
        )

    if not master.can_be_master:
        return CreateLobbyFromBotResult(
            error="У вас нет роли мастера. Обратитесь к администратору.",
        )

    unique_usernames: list[str] = []
    seen: set[str] = set()
    for raw in tg_usernames:
        key = _normalize_tg(raw)
        if not key or key in seen:
            continue
        seen.add(key)
        unique_usernames.append(key)

    found = await _find_users_by_tg_usernames(unique_usernames)
    not_found = [u for u in unique_usernames if u not in found]

    invited: list[models.User] = []
    skipped_master: list[str] = []
    for username in unique_usernames:
        user = found.get(username)
        if user is None:
            continue
        if user.id == master.id:
            skipped_master.append(username)
            continue
        invited.append(user)

    name = lobby_name.strip() or f"Лобби {master.full_name or master.tg or 'мастера'}"
    max_players = max(4, len(invited) + 1)

    lobby_data = scheme.LobbyCreate(name=name, max_players=max_players)
    lobby = await lobby_manager.create_lobby(lobby_data, master)

    # Приглашённые — не «подключённые»: в users лежат только те, у кого открыт сокет.
    # Иначе они числились бы онлайн с момента создания лобби.
    for user in invited:
        await lobby_manager[str(lobby.id)].invite_user(user)
    if invited:
        lobby = await lobby_manager[str(lobby.id)].get_lobby()
        result_notified = await notify_lobby_invited(
            lobby_id=lobby.id,
            user_ids=[u.id for u in invited],
            lobby_name=lobby.name,
            master_name=master.full_name or master.tg,
        )
    else:
        result_notified = 0

    return CreateLobbyFromBotResult(
        lobby=lobby,
        invited=invited,
        not_found=not_found,
        skipped_master=skipped_master,
        notified=result_notified,
    )


async def create_lobby_from_bot_dict(
    *,
    master_telegram_id: int,
    lobby_name: str,
    tg_usernames: list[str],
    master_username: str | None = None,
) -> dict[str, Any]:
    result = await create_lobby_from_bot(
        master_telegram_id=master_telegram_id,
        lobby_name=lobby_name,
        tg_usernames=tg_usernames,
        master_username=master_username,
    )
    return result_to_dict(result)
