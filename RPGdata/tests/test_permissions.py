"""Unit tests for scenario permission resolution."""

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.auth.permissions import (
    PERM_ALL,
    PERM_NONE,
    PERM_READ,
    get_scenario_permission,
    has_at_least,
    max_permission,
    normalize_permission,
    permission_rank,
)
from app import scheme


def test_permission_rank_uses_string_values_from_db():
    assert permission_rank("read") == permission_rank(scheme.RoleAccess.READ_ROLE)
    assert permission_rank("edit_full") > permission_rank("read")


def test_max_permission_picks_highest():
    assert max_permission(["read", "edit_partial", "read"]) == "edit_partial"
    assert max_permission(["none", None]) == PERM_NONE


def test_has_at_least():
    assert has_at_least("read", "read")
    assert has_at_least("edit_full", "read")
    assert not has_at_least("read", "edit_partial")


def test_normalize_permission_enum_and_unknown():
    assert normalize_permission(scheme.RoleAccess.READ_ROLE) == PERM_READ
    assert normalize_permission("bogus") == PERM_NONE


def _mock_db(rows):
    """``rows``: (group_grant, member_level) pairs as returned by the join query."""
    db = AsyncMock()

    async def execute(stmt):
        result = MagicMock()
        result.all.return_value = rows
        return result

    db.execute.side_effect = execute
    return db


@pytest.mark.asyncio
async def test_creator_gets_all_without_groups():
    user = MagicMock(is_admin=False, id=uuid.uuid4())
    scenario = MagicMock(user_id=user.id, id=uuid.uuid4())
    db = _mock_db([])

    perm = await get_scenario_permission(db, user, scenario)
    assert perm == PERM_ALL


@pytest.mark.asyncio
async def test_group_read_permission_applied():
    user = MagicMock(is_admin=False, id=uuid.uuid4())
    scenario = MagicMock(user_id=uuid.uuid4(), id=uuid.uuid4())
    db = _mock_db([("read", "all")])

    perm = await get_scenario_permission(db, user, scenario)
    assert perm == PERM_READ
    assert has_at_least(perm, PERM_READ)
    assert not has_at_least(perm, "edit_full")


@pytest.mark.asyncio
async def test_admin_always_all():
    user = MagicMock(is_admin=True, id=uuid.uuid4())
    scenario = MagicMock(user_id=None, id=uuid.uuid4())
    db = AsyncMock()

    perm = await get_scenario_permission(db, user, scenario)
    assert perm == PERM_ALL


@pytest.mark.asyncio
async def test_member_level_caps_group_grant():
    user = MagicMock(is_admin=False, id=uuid.uuid4())
    scenario = MagicMock(user_id=uuid.uuid4(), id=uuid.uuid4())

    perm = await get_scenario_permission(_mock_db([("edit_full", "read")]), user, scenario)
    assert perm == PERM_READ


@pytest.mark.asyncio
async def test_best_group_wins_after_capping():
    user = MagicMock(is_admin=False, id=uuid.uuid4())
    scenario = MagicMock(user_id=uuid.uuid4(), id=uuid.uuid4())

    perm = await get_scenario_permission(
        _mock_db([("all", "read"), ("edit_full", "edit_full")]), user, scenario
    )
    assert perm == "edit_full"


def test_min_permission():
    from app.auth.permissions import min_permission

    assert min_permission("edit_full", "read") == "read"
    assert min_permission("read", "all") == "read"
    assert min_permission("bogus", "all") == PERM_NONE
