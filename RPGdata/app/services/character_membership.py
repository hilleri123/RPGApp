"""Связь персонажа со сценариями. Один персонаж может быть в нескольких."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models

ORIGIN_NATIVE = "native"
ORIGIN_APPLICATION = "application"
ORIGIN_OTHER = "other"


def in_scenario(scenario_id: UUID):
    return models.PlayerCharacter.id.in_(
        select(models.CharacterScenario.character_id).where(
            models.CharacterScenario.scenario_id == scenario_id
        )
    )


def without_scenario():
    return ~models.PlayerCharacter.scenario_links.any()


def scope_clause(model, scenario_id: UUID):
    if model is models.PlayerCharacter:
        return in_scenario(scenario_id)
    return model.scenario_id == scenario_id


async def first_scenario_id(db: AsyncSession, character_id: UUID) -> UUID | None:
    return (
        await db.execute(
            select(models.CharacterScenario.scenario_id)
            .where(models.CharacterScenario.character_id == character_id)
            .limit(1)
        )
    ).scalar_one_or_none()


async def link_character(
    db: AsyncSession,
    character_id: UUID,
    scenario_id: UUID,
    origin: str,
) -> models.CharacterScenario:
    row = (
        await db.execute(
            select(models.CharacterScenario).where(
                models.CharacterScenario.character_id == character_id,
                models.CharacterScenario.scenario_id == scenario_id,
            )
        )
    ).scalar_one_or_none()
    if row is None:
        row = models.CharacterScenario(
            character_id=character_id,
            scenario_id=scenario_id,
            origin=origin,
        )
        db.add(row)
        return row
    if row.origin == ORIGIN_NATIVE:
        return row
    if origin == ORIGIN_NATIVE:
        row.origin = ORIGIN_NATIVE
    elif origin == ORIGIN_APPLICATION:
        row.origin = ORIGIN_APPLICATION
    return row


async def unlink_character(
    db: AsyncSession,
    character_id: UUID,
    scenario_id: UUID,
    *,
    origin: str | None = None,
) -> None:
    stmt = delete(models.CharacterScenario).where(
        models.CharacterScenario.character_id == character_id,
        models.CharacterScenario.scenario_id == scenario_id,
    )
    if origin is not None:
        stmt = stmt.where(models.CharacterScenario.origin == origin)
    await db.execute(stmt)


async def is_in_scenario(db: AsyncSession, character_id: UUID, scenario_id: UUID) -> bool:
    found = (
        await db.execute(
            select(models.CharacterScenario.character_id).where(
                models.CharacterScenario.character_id == character_id,
                models.CharacterScenario.scenario_id == scenario_id,
            )
        )
    ).scalar_one_or_none()
    return found is not None


async def has_any_link(db: AsyncSession, character_id: UUID) -> bool:
    found = (
        await db.execute(
            select(models.CharacterScenario.character_id)
            .where(models.CharacterScenario.character_id == character_id)
            .limit(1)
        )
    ).scalar_one_or_none()
    return found is not None
