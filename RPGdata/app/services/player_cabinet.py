"""Игры, которые вели этому игроку, и его персонажи."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app import models
from app.scheme.player_cabinet import (
    MyCharacterGameOut,
    MyCharacterOut,
    MyCharactersOut,
    PlayedEveningOut,
    PlayedGameOut,
    PlayedGamesOut,
)


@dataclass
class Membership:
    launched_scenario_id: UUID
    scenario_name: str
    owner_id: UUID | None
    owner_name: str | None
    character_name: str | None
    color: str | None


@dataclass
class Evening:
    session_id: UUID
    launched_scenario_id: UUID | None
    name: str
    scenario_name: str | None
    created_at: datetime | None
    is_active: bool
    master_name: str | None
    character_name: str | None


def display_name(user: models.User | None) -> str | None:
    if user is None:
        return None
    return user.full_name or user.tg or None


def _snapshot_name(player: models.Player | None) -> str | None:
    if player is None:
        return None
    snap = player.character_snapshot or {}
    if isinstance(snap, dict) and snap.get("name"):
        return str(snap["name"])
    return None


def build_played_games(user_id: UUID, memberships: list[Membership], evenings: list[Evening]) -> PlayedGamesOut:
    by_launch: dict[UUID, list[Evening]] = {}
    loose: list[Evening] = []
    for evening in evenings:
        if evening.launched_scenario_id is None:
            loose.append(evening)
        else:
            by_launch.setdefault(evening.launched_scenario_id, []).append(evening)

    cards: list[PlayedGameOut] = []
    seen: set[UUID] = set()
    for member in memberships:
        seen.add(member.launched_scenario_id)
        group = by_launch.get(member.launched_scenario_id, [])
        if member.owner_id == user_id and not group:
            continue
        cards.append(_card(
            card_id=str(member.launched_scenario_id),
            name=member.scenario_name,
            master_name=_master(group, member.owner_name if member.owner_id != user_id else None),
            character_name=member.character_name or _character(group),
            color=member.color,
            evenings=group,
        ))

    for launch_id, group in by_launch.items():
        if launch_id in seen or not group:
            continue
        cards.append(_card(
            card_id=str(launch_id),
            name=group[0].scenario_name or group[0].name,
            master_name=_master(group, None),
            character_name=_character(group),
            color=None,
            evenings=group,
        ))

    for evening in loose:
        cards.append(_card(
            card_id=str(evening.session_id),
            name=evening.name,
            master_name=evening.master_name,
            character_name=evening.character_name,
            color=None,
            evenings=[evening],
        ))

    cards.sort(key=lambda card: _when(card.played_at), reverse=True)
    return PlayedGamesOut(items=cards)


def _when(value: datetime | None) -> float:
    if value is None:
        return float("-inf")
    return value.timestamp()


def _master(evenings: list[Evening], fallback: str | None) -> str | None:
    ordered = sorted(evenings, key=lambda item: _when(item.created_at), reverse=True)
    for evening in ordered:
        if evening.master_name:
            return evening.master_name
    return fallback


def _character(evenings: list[Evening]) -> str | None:
    ordered = sorted(evenings, key=lambda item: _when(item.created_at), reverse=True)
    for evening in ordered:
        if evening.character_name:
            return evening.character_name
    return None


def _card(
    *,
    card_id: str,
    name: str,
    master_name: str | None,
    character_name: str | None,
    color: str | None,
    evenings: list[Evening],
) -> PlayedGameOut:
    ordered = sorted(evenings, key=lambda item: _when(item.created_at), reverse=True)
    active = next((item for item in ordered if item.is_active), None)
    played_at = ordered[0].created_at if ordered else None
    return PlayedGameOut(
        id=card_id,
        name=name,
        master_name=master_name,
        character_name=character_name,
        color=color,
        active_session_id=active.session_id if active else None,
        played_at=played_at,
        evenings=[
            PlayedEveningOut(
                session_id=item.session_id,
                name=item.name,
                created_at=item.created_at,
                is_active=item.is_active,
                character_name=item.character_name,
            )
            for item in ordered
        ],
    )


def _url(value) -> str | None:
    if not value:
        return None
    return str(value)


async def played_games(db: AsyncSession, user_id: UUID) -> PlayedGamesOut:
    member_rows = (
        await db.execute(
            select(models.LaunchedScenarioPlayer, models.Scenario, models.User)
            .join(models.Scenario, models.Scenario.id == models.LaunchedScenarioPlayer.launched_scenario_id)
            .outerjoin(models.User, models.User.id == models.Scenario.user_id)
            .where(models.LaunchedScenarioPlayer.user_id == user_id)
            .options(selectinload(models.LaunchedScenarioPlayer.character))
        )
    ).all()
    memberships = [
        Membership(
            launched_scenario_id=member.launched_scenario_id,
            scenario_name=scenario.name,
            owner_id=scenario.user_id,
            owner_name=display_name(owner),
            character_name=member.character.name if member.character else None,
            color=member.color,
        )
        for member, scenario, owner in member_rows
    ]

    sessions = (
        await db.execute(
            select(models.GameSession)
            .options(
                selectinload(models.GameSession.players),
                selectinload(models.GameSession.master),
                selectinload(models.GameSession.launched_scenario),
            )
            .where(
                models.GameSession.players.any(models.Player.user_id == user_id),
                models.GameSession.master_id != user_id,
            )
        )
    ).scalars().all()
    evenings = []
    for session in sessions:
        mine = next((player for player in session.players or [] if player.user_id == user_id), None)
        launched = session.launched_scenario
        evenings.append(
            Evening(
                session_id=session.id,
                launched_scenario_id=session.launched_scenario_id,
                name=session.name or "Игра",
                scenario_name=launched.name if launched else None,
                created_at=session.created_at,
                is_active=bool(session.is_active),
                master_name=display_name(session.master),
                character_name=_snapshot_name(mine),
            )
        )
    return build_played_games(user_id, memberships, evenings)


async def my_characters(db: AsyncSession, user_id: UUID) -> MyCharactersOut:
    rows = (
        await db.execute(
            select(models.PlayerCharacter)
            .where(models.PlayerCharacter.bound_user_id == user_id)
            .options(
                selectinload(models.PlayerCharacter.scenario_links).selectinload(models.CharacterScenario.scenario)
            )
            .order_by(models.PlayerCharacter.name)
        )
    ).scalars().all()
    items = []
    for character in rows:
        games = []
        seen: set[UUID] = set()
        for link in character.scenario_links or []:
            scenario = link.scenario
            if scenario is None or scenario.id in seen:
                continue
            seen.add(scenario.id)
            games.append(MyCharacterGameOut(scenario_id=scenario.id, name=scenario.name))
        items.append(
            MyCharacterOut(
                id=character.id,
                name=character.name,
                short_desc=character.short_desc,
                img_url=_url(character.img_url),
                icon_url=_url(character.icon_url),
                games=games,
            )
        )
    return MyCharactersOut(items=items)
