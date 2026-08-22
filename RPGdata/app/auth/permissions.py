from __future__ import annotations

from typing import Iterable, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, scheme

PERM_NONE = scheme.RoleAccess.NONE_ROLE.value
PERM_READ = scheme.RoleAccess.READ_ROLE.value
PERM_EDIT_PARTIAL = scheme.RoleAccess.EDIT_PARTIAL_ROLE.value
PERM_EDIT_FULL = scheme.RoleAccess.EDIT_FULL_ROLE.value
PERM_ALL = scheme.RoleAccess.ALL_ROLE.value

PERM_RANK: dict[str, int] = {
    PERM_NONE: 0,
    PERM_READ: 1,
    PERM_EDIT_PARTIAL: 2,
    PERM_EDIT_FULL: 3,
    PERM_ALL: 4,
}


def normalize_permission(perm: object | None) -> str:
    if perm is None:
        return PERM_NONE
    if isinstance(perm, scheme.RoleAccess):
        return perm.value
    value = str(perm).strip()
    return value if value in PERM_RANK else PERM_NONE


def permission_rank(perm: object | None) -> int:
    return PERM_RANK.get(normalize_permission(perm), 0)


def max_permission(perms: Iterable[object | None]) -> str:
    best = PERM_NONE
    best_rank = 0
    for perm in perms:
        rank = permission_rank(perm)
        if rank > best_rank:
            best_rank = rank
            best = normalize_permission(perm)
    return best


def has_at_least(actual: object | None, required: object | None) -> bool:
    return permission_rank(actual) >= permission_rank(required)


async def _user_group_ids(db: AsyncSession, user_id: UUID) -> list[UUID]:
    result = await db.execute(
        select(models.UserMasterGroup.master_group_id).where(
            models.UserMasterGroup.user_id == user_id
        )
    )
    return list(result.scalars().all())


async def _group_permissions(
    db: AsyncSession,
    *,
    user: models.User,
    object_type: str,
    object_id: UUID,
) -> list[str]:
    if user.is_admin:
        return [PERM_ALL]

    group_ids = await _user_group_ids(db, user.id)
    if not group_ids:
        return []

    if object_type == "scenario":
        stmt = select(models.MasterGroupScenarioAccess.permission).where(
            models.MasterGroupScenarioAccess.scenario_id == object_id,
            models.MasterGroupScenarioAccess.master_group_id.in_(group_ids),
        )
    else:
        raise ValueError(f"Unsupported object_type: {object_type}")

    result = await db.execute(stmt)
    return [normalize_permission(p) for p in result.scalars().all()]


async def get_max_permission_for_user(
    db: AsyncSession,
    user: models.User,
    object_type: str,
    object_id: UUID,
) -> str:
    """Max permission from master groups only (no creator fallback)."""
    perms = await _group_permissions(db, user=user, object_type=object_type, object_id=object_id)
    return max_permission(perms)


async def get_scenario_permission(
    db: AsyncSession,
    user: models.User,
    scenario: models.Scenario,
) -> str:
    """
    Effective scenario permission:
    - admin: all
    - creator (user_id): all
    - otherwise: max permission across user's groups
    """
    if user.is_admin:
        return PERM_ALL

    perms: list[str] = []

    if scenario.user_id and scenario.user_id == user.id:
        perms.append(PERM_ALL)

    group_perm = await get_max_permission_for_user(
        db=db,
        user=user,
        object_type="scenario",
        object_id=scenario.id,
    )
    if group_perm != PERM_NONE:
        perms.append(group_perm)

    return max_permission(perms)


def can_view_scenario(perm: str) -> bool:
    return has_at_least(perm, PERM_READ)


def can_copy_scenario(perm: str) -> bool:
    return has_at_least(perm, PERM_READ)


def can_edit_scenario_entities(perm: str) -> bool:
    return has_at_least(perm, PERM_EDIT_PARTIAL)


def can_edit_scenario_meta(perm: str) -> bool:
    return has_at_least(perm, PERM_EDIT_FULL)


def can_delete_scenario(perm: str) -> bool:
    return has_at_least(perm, PERM_ALL)
