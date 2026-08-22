"""Per-player seen state stored in PostgreSQL (player_seen table)."""

from __future__ import annotations

from typing import Iterable, Set
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.scheme.seen import PlayerSeenEntry, SeenDataAccess
from app.services.entity_seen import resolve_seen_entries_from_inner


def _to_uuid_set(ids: Iterable) -> Set[UUID]:
    out: Set[UUID] = set()
    for x in ids or []:
        try:
            out.add(UUID(str(x)))
        except (TypeError, ValueError):
            continue
    return out


def _parse_data_access(value: str | SeenDataAccess | None) -> SeenDataAccess:
    if isinstance(value, SeenDataAccess):
        return value
    if not value:
        return SeenDataAccess.NONE
    try:
        return SeenDataAccess(str(value))
    except ValueError:
        return SeenDataAccess.NONE


async def get_player_seen(
    db: AsyncSession,
    *,
    launched_scenario_id: UUID,
    user_id: UUID,
) -> tuple[Set[UUID], Set[UUID], list[PlayerSeenEntry]]:
    seen_stmt = select(models.PlayerSeen).where(
        models.PlayerSeen.launched_scenario_id == launched_scenario_id,
        models.PlayerSeen.user_id == user_id,
    )
    seen_rows = (await db.execute(seen_stmt)).scalars().all()
    seen_ids = _to_uuid_set(row.entity_id for row in seen_rows)
    records = [
        PlayerSeenEntry(
            entity_type=row.entity_type,
            entity_id=row.entity_id,
            data_access=_parse_data_access(row.data_access),
        )
        for row in seen_rows
    ]

    poly_stmt = select(models.PlayerSeenState).where(
        models.PlayerSeenState.launched_scenario_id == launched_scenario_id,
        models.PlayerSeenState.user_id == user_id,
    )
    poly_row = (await db.execute(poly_stmt)).scalars().first()
    polygon_ids = _to_uuid_set(poly_row.polygon_shown_ids if poly_row else [])

    return seen_ids, polygon_ids, records


async def _ensure_polygon_state_row(
    db: AsyncSession,
    *,
    launched_scenario_id: UUID,
    user_id: UUID,
) -> models.PlayerSeenState:
    stmt = select(models.PlayerSeenState).where(
        models.PlayerSeenState.launched_scenario_id == launched_scenario_id,
        models.PlayerSeenState.user_id == user_id,
    )
    row = (await db.execute(stmt)).scalars().first()
    if row is None:
        row = models.PlayerSeenState(
            launched_scenario_id=launched_scenario_id,
            user_id=user_id,
            seen_ids=[],
            polygon_shown_ids=[],
        )
        db.add(row)
        await db.flush()
    return row


async def revoke_entity_data_access(
    db: AsyncSession,
    *,
    launched_scenario_id: UUID,
    user_ids: Iterable[UUID],
    entity_type: str,
    entity_id: UUID,
) -> None:
    """Revoke full data access for one entity from the given players (upsert)."""
    for uid in user_ids:
        stmt = (
            pg_insert(models.PlayerSeen)
            .values(
                launched_scenario_id=launched_scenario_id,
                user_id=uid,
                entity_type=entity_type,
                entity_id=entity_id,
                data_access=SeenDataAccess.NONE.value,
            )
            .on_conflict_do_update(
                constraint="uq_player_seen_entry",
                set_={"data_access": SeenDataAccess.NONE.value},
            )
        )
        await db.execute(stmt)
    await db.flush()


async def grant_entity_data_access(
    db: AsyncSession,
    *,
    launched_scenario_id: UUID,
    user_ids: Iterable[UUID],
    entity_type: str,
    entity_id: UUID,
) -> None:
    """Grant full data access for one entity to the given players (upsert)."""
    for uid in user_ids:
        stmt = (
            pg_insert(models.PlayerSeen)
            .values(
                launched_scenario_id=launched_scenario_id,
                user_id=uid,
                entity_type=entity_type,
                entity_id=entity_id,
                data_access=SeenDataAccess.FULL.value,
            )
            .on_conflict_do_update(
                constraint="uq_player_seen_entry",
                set_={"data_access": SeenDataAccess.FULL.value},
            )
        )
        await db.execute(stmt)
    await db.flush()


async def get_revealed_data_entities(
    db: AsyncSession,
    *,
    launched_scenario_id: UUID,
) -> list[PlayerSeenEntry]:
    stmt = (
        select(models.PlayerSeen.entity_type, models.PlayerSeen.entity_id)
        .where(
            models.PlayerSeen.launched_scenario_id == launched_scenario_id,
            models.PlayerSeen.data_access == SeenDataAccess.FULL.value,
        )
        .distinct()
    )
    rows = (await db.execute(stmt)).all()
    out: list[PlayerSeenEntry] = []
    seen_keys: set[tuple[str, UUID]] = set()
    for entity_type, entity_id in rows:
        key = (entity_type, entity_id)
        if key in seen_keys:
            continue
        seen_keys.add(key)
        out.append(
            PlayerSeenEntry(
                entity_type=entity_type,
                entity_id=entity_id,
                data_access=SeenDataAccess.FULL,
            )
        )
    return out


async def add_player_seen_entries(
    db: AsyncSession,
    *,
    launched_scenario_id: UUID,
    user_id: UUID,
    entries: Iterable[tuple[str, UUID, SeenDataAccess | None] | tuple[str, UUID]],
) -> None:
    for entry in entries:
        if len(entry) == 3:
            entity_type, entity_id, data_access = entry
        else:
            entity_type, entity_id = entry
            data_access = SeenDataAccess.NONE

        stmt = (
            pg_insert(models.PlayerSeen)
            .values(
                launched_scenario_id=launched_scenario_id,
                user_id=user_id,
                entity_type=entity_type,
                entity_id=entity_id,
                data_access=_parse_data_access(data_access).value,
            )
            .on_conflict_do_nothing(constraint="uq_player_seen_entry")
        )
        await db.execute(stmt)
    await db.flush()


async def add_player_seen(
    db: AsyncSession,
    *,
    launched_scenario_id: UUID,
    user_id: UUID,
    seen_ids: Iterable[UUID] | None = None,
    polygon_shown_ids: Iterable[UUID] | None = None,
    inner=None,
    data_access: SeenDataAccess = SeenDataAccess.NONE,
) -> None:
    if seen_ids and inner is not None:
        resolved = resolve_seen_entries_from_inner(inner, seen_ids)
        entries = [(entity_type, entity_id, data_access) for entity_type, entity_id in resolved]
        await add_player_seen_entries(
            db,
            launched_scenario_id=launched_scenario_id,
            user_id=user_id,
            entries=entries,
        )

    if polygon_shown_ids:
        row = await _ensure_polygon_state_row(
            db,
            launched_scenario_id=launched_scenario_id,
            user_id=user_id,
        )
        poly = _to_uuid_set(row.polygon_shown_ids)
        poly.update(polygon_shown_ids)
        row.polygon_shown_ids = [str(x) for x in poly]
        await db.flush()


async def add_seen_for_users(
    db: AsyncSession,
    *,
    launched_scenario_id: UUID,
    user_ids: Iterable[UUID],
    seen_ids: Iterable[UUID] | None = None,
    polygon_shown_ids: Iterable[UUID] | None = None,
    inner=None,
    data_access: SeenDataAccess = SeenDataAccess.NONE,
) -> None:
    for uid in user_ids:
        await add_player_seen(
            db,
            launched_scenario_id=launched_scenario_id,
            user_id=uid,
            seen_ids=seen_ids,
            polygon_shown_ids=polygon_shown_ids,
            inner=inner,
            data_access=data_access,
        )
