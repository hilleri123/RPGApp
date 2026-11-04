"""Текущий персонаж и цвет игрока запущенного сценария.

После игры заявка смотрит на ту же строку PlayerCharacter, что лежит в сценарии.
Новая строка персонажа здесь не создаётся.
"""

from __future__ import annotations

import uuid
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.services.character_membership import in_scenario, is_in_scenario


def _text(value: Any) -> str | None:
    if value is None:
        return None
    return str(value)


def _character_fields(pc: models.PlayerCharacter, fields: dict | None) -> dict:
    src = fields or {}
    data = src.get("data") if isinstance(src.get("data"), dict) else None
    if data is None:
        data = dict(pc.data or {})
    tags = src.get("tags")
    if tags is None:
        tags = list(pc.tags or [])
    return {
        "name": src.get("name") or pc.name or "Безымянный персонаж",
        "short_desc": src.get("short_desc") if "short_desc" in src else pc.short_desc,
        "story": src.get("story") if "story" in src else pc.story,
        "tags": tags,
        "data": data,
        "icon_url": src.get("icon_url") if "icon_url" in src else _text(pc.icon_url),
        "img_url": src.get("img_url") if "img_url" in src else _text(pc.img_url),
    }


def _copy_onto_application(
    app: models.CharacterApplication,
    pc: models.PlayerCharacter,
    fields: dict | None,
    *,
    history_entry: dict | None,
) -> None:
    copied = _character_fields(pc, fields)
    old_data = app.data or {}
    history = list(old_data.get("_history") or [])
    data = dict(copied["data"] or {})
    if history_entry is not None:
        history.append(history_entry)
    if history:
        data["_history"] = history
    app.name = copied["name"]
    app.short_desc = copied["short_desc"]
    app.story = copied["story"]
    app.tags = copied["tags"]
    app.data = data
    app.icon_url = copied["icon_url"]
    app.img_url = copied["img_url"]
    app.player_character_id = pc.id
    app.status = models.ApplicationStatus.approved


async def _application_for_character(
    db: AsyncSession,
    pc: models.PlayerCharacter,
) -> models.CharacterApplication | None:
    app = (
        await db.execute(
            select(models.CharacterApplication).where(
                models.CharacterApplication.player_character_id == pc.id
            )
        )
    ).scalar_one_or_none()
    if app is not None:
        return app
    # Раньше финиш создавал заявку с id персонажа и без player_character_id.
    legacy = await db.get(models.CharacterApplication, pc.id)
    if legacy is not None and legacy.player_character_id is None:
        return legacy
    return None


async def bind_character_to_user(
    db: AsyncSession,
    *,
    pc: models.PlayerCharacter,
    user_id: UUID,
    rule_id_str: str | None = None,
    fields: dict | None = None,
    history_entry: dict | None = None,
    source_session_id: UUID | None = None,
    source_player_id: UUID | None = None,
    scenario_id: UUID | None = None,
) -> models.CharacterApplication:
    """Один игрок — один текущий персонаж сценария. Заявка ссылается на эту строку."""
    if scenario_id is not None:
        others = (
            await db.execute(
                select(models.PlayerCharacter).where(
                    in_scenario(scenario_id),
                    models.PlayerCharacter.bound_user_id == user_id,
                    models.PlayerCharacter.id != pc.id,
                )
            )
        ).scalars().all()
        for other in others:
            other.bound_user_id = None
    pc.bound_user_id = user_id
    if scenario_id is not None:
        taken = (
            await db.execute(
                select(models.LaunchedScenarioPlayer).where(
                    models.LaunchedScenarioPlayer.launched_scenario_id == scenario_id,
                    models.LaunchedScenarioPlayer.character_id == pc.id,
                    models.LaunchedScenarioPlayer.user_id != user_id,
                )
            )
        ).scalars().all()
        for row in taken:
            row.character_id = None

    app = await _application_for_character(db, pc)
    if app is None:
        app = models.CharacterApplication(
            id=uuid.uuid4(),
            user_id=user_id,
            rule_id_str=rule_id_str or "",
            name=pc.name or "Безымянный персонаж",
            status=models.ApplicationStatus.approved,
            source_kind="session_result",
            source_session_id=source_session_id,
            source_player_id=source_player_id,
            is_result_snapshot=True,
            player_character_id=pc.id,
        )
        db.add(app)
    app.user_id = user_id
    if rule_id_str:
        app.rule_id_str = rule_id_str
    if source_session_id is not None:
        app.source_kind = "session_result"
        app.source_session_id = source_session_id
        app.source_player_id = source_player_id
        app.is_result_snapshot = True
    _copy_onto_application(app, pc, fields, history_entry=history_entry)
    await db.flush()
    return app


async def upsert_launched_player(
    db: AsyncSession,
    *,
    launched_scenario_id: UUID,
    user_id: UUID,
    character_id: UUID | None,
    color: str | None,
) -> models.LaunchedScenarioPlayer:
    row = (
        await db.execute(
            select(models.LaunchedScenarioPlayer).where(
                models.LaunchedScenarioPlayer.launched_scenario_id == launched_scenario_id,
                models.LaunchedScenarioPlayer.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if row is None:
        row = models.LaunchedScenarioPlayer(
            launched_scenario_id=launched_scenario_id,
            user_id=user_id,
            character_id=character_id,
            color=color or "#ffffff",
        )
        db.add(row)
    else:
        row.character_id = character_id
        if color:
            row.color = color
    await db.flush()
    return row


async def remember_played_character(
    db: AsyncSession,
    *,
    launched_scenario_id: UUID | None,
    user_id: UUID,
    character_id: UUID,
    color: str | None,
    fields: dict | None,
    rule_id_str: str | None,
    session_id: UUID,
    player_id: UUID,
    session_name: str | None,
) -> None:
    pc = await db.get(models.PlayerCharacter, character_id)
    if pc is None:
        return
    await bind_character_to_user(
        db,
        pc=pc,
        user_id=user_id,
        rule_id_str=rule_id_str,
        fields=fields,
        history_entry={
            "kind": "session_result",
            "session_id": str(session_id),
            "player_id": str(player_id),
            "session_name": session_name,
        },
        source_session_id=session_id,
        source_player_id=player_id,
        scenario_id=launched_scenario_id,
    )
    if launched_scenario_id is not None:
        await upsert_launched_player(
            db,
            launched_scenario_id=launched_scenario_id,
            user_id=user_id,
            character_id=pc.id,
            color=color,
        )


async def assign_launched_player(
    db: AsyncSession,
    *,
    launched: models.Scenario,
    user_id: UUID,
    character_id: UUID | None,
    color: str | None,
) -> models.LaunchedScenarioPlayer:
    if character_id is not None:
        pc = await db.get(models.PlayerCharacter, character_id)
        if pc is None or not await is_in_scenario(db, pc.id, launched.id):
            raise ValueError("character is not in this launched scenario")
        await bind_character_to_user(
            db,
            pc=pc,
            user_id=user_id,
            rule_id_str=launched.rule_id_str,
            fields=None,
            scenario_id=launched.id,
        )
    else:
        bound = (
            await db.execute(
                select(models.PlayerCharacter).where(
                    in_scenario(launched.id),
                    models.PlayerCharacter.bound_user_id == user_id,
                )
            )
        ).scalars().all()
        for pc in bound:
            pc.bound_user_id = None
    return await upsert_launched_player(
        db,
        launched_scenario_id=launched.id,
        user_id=user_id,
        character_id=character_id,
        color=color,
    )


async def list_launched_players(
    db: AsyncSession,
    launched_scenario_id: UUID,
) -> dict:
    session_rows = (
        await db.execute(
            select(models.Player, models.User)
            .join(models.User, models.Player.user_id == models.User.id)
            .join(models.GameSession, models.Player.game_session_id == models.GameSession.id)
            .where(models.GameSession.launched_scenario_id == launched_scenario_id)
            .order_by(models.GameSession.created_at.desc())
        )
    ).all()

    players: dict[UUID, dict] = {}
    for player, user in session_rows:
        if user.id in players:
            continue
        players[user.id] = {
            "user_id": user.id,
            "name": user.full_name or player.name or "Игрок",
            "color": player.color or "#ffffff",
            "character_id": player.character_id,
            "pinned": False,
        }

    characters = list(
        (
            await db.execute(
                select(models.PlayerCharacter)
                .where(in_scenario(launched_scenario_id))
                .order_by(models.PlayerCharacter.name)
            )
        ).scalars().all()
    )
    for ch in characters:
        if ch.bound_user_id is None:
            continue
        slot = players.get(ch.bound_user_id)
        if slot is None:
            user = await db.get(models.User, ch.bound_user_id)
            slot = {
                "user_id": ch.bound_user_id,
                "name": (user.full_name if user else None) or "Игрок",
                "color": "#ffffff",
                "character_id": ch.id,
                "pinned": False,
            }
            players[ch.bound_user_id] = slot
        elif not slot["pinned"]:
            slot["character_id"] = ch.id

    prefs = (
        await db.execute(
            select(models.LaunchedScenarioPlayer).where(
                models.LaunchedScenarioPlayer.launched_scenario_id == launched_scenario_id
            )
        )
    ).scalars().all()
    for pref in prefs:
        slot = players.get(pref.user_id)
        if slot is None:
            user = await db.get(models.User, pref.user_id)
            slot = {
                "user_id": pref.user_id,
                "name": (user.full_name if user else None) or "Игрок",
                "color": pref.color or "#ffffff",
                "character_id": pref.character_id,
                "pinned": True,
            }
            players[pref.user_id] = slot
        else:
            slot["pinned"] = True
            slot["character_id"] = pref.character_id
            if pref.color:
                slot["color"] = pref.color

    known_ids = {ch.id for ch in characters}
    out_players = []
    for slot in players.values():
        character_id = slot["character_id"]
        if character_id is not None and character_id not in known_ids:
            character_id = None
        out_players.append(
            {
                "user_id": slot["user_id"],
                "name": slot["name"],
                "color": slot["color"] or "#ffffff",
                "character_id": character_id,
            }
        )
    out_players.sort(key=lambda item: (item["name"] or "").lower())
    return {
        "players": out_players,
        "characters": [
            {"id": ch.id, "name": ch.name, "bound_user_id": ch.bound_user_id}
            for ch in characters
        ],
    }
