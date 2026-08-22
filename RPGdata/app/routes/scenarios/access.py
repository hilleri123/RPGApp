"""Scenario access checks including session snapshots."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.auth.permissions import (
    PERM_READ,
    can_copy_scenario,
    can_view_scenario,
    get_scenario_permission,
    has_at_least,
)


async def _active_session_for_user(
    db: AsyncSession,
    *,
    scenario_id: UUID,
    user_id: UUID,
    as_master: bool,
) -> models.GameSession | None:
    """Find an active session on this snapshot (or launched_scenario) for the user."""
    session_on_scenario = or_(
        models.GameSession.scenario_id == scenario_id,
        models.GameSession.launched_scenario_id == scenario_id,
    )
    if as_master:
        return (
            await db.execute(
                select(models.GameSession).where(
                    session_on_scenario,
                    models.GameSession.master_id == user_id,
                    models.GameSession.is_active == True,  # noqa: E712
                )
            )
        ).scalars().first()

    return (
        await db.execute(
            select(models.GameSession)
            .join(models.Player, models.Player.game_session_id == models.GameSession.id)
            .where(
                session_on_scenario,
                models.GameSession.is_active == True,  # noqa: E712
                models.Player.user_id == user_id,
            )
        )
    ).scalars().first()


async def require_scenario_access(
    db: AsyncSession,
    user: models.User,
    scenario: models.Scenario,
    min_permission: str = PERM_READ,
) -> str:
    perm = await get_scenario_permission(db, user, scenario)

    if scenario.is_session_snapshot:
        if can_view_scenario(perm) and has_at_least(perm, min_permission):
            return perm

        if scenario.source_scenario_id:
            src = await db.get(models.Scenario, scenario.source_scenario_id)
            if src:
                src_perm = await get_scenario_permission(db, user, src)
                if has_at_least(src_perm, min_permission):
                    return src_perm

        # Master of an active session on this snapshot: read access for live play APIs.
        if await _active_session_for_user(
            db, scenario_id=scenario.id, user_id=user.id, as_master=True
        ) and has_at_least(PERM_READ, min_permission):
            return PERM_READ

        # Player in an active session: read-only (character sheet schema/options, etc.).
        if await _active_session_for_user(
            db, scenario_id=scenario.id, user_id=user.id, as_master=False
        ) and has_at_least(PERM_READ, min_permission):
            return PERM_READ

    if not has_at_least(perm, min_permission):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет доступа")

    return perm


async def can_access_scenario(
    db: AsyncSession,
    user: models.User,
    scenario: models.Scenario,
) -> bool:
    try:
        await require_scenario_access(db, user, scenario, PERM_READ)
        return True
    except HTTPException:
        return False


async def can_duplicate_scenario(
    db: AsyncSession,
    user: models.User,
    scenario: models.Scenario,
) -> bool:
    perm = await get_scenario_permission(db, user, scenario)
    return can_copy_scenario(perm)
