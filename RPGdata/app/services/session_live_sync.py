"""Push live session WS updates after REST edits to session scenario snapshots."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.logger import logger


async def notify_session_snapshot_entity_change(
    db: AsyncSession,
    scenario_id: UUID,
    fields: list[str],
) -> None:
    """Invalidate entity cache and broadcast session_update for active sessions on this snapshot."""
    if not fields:
        return

    scenario = await db.get(models.Scenario, scenario_id)
    if not scenario or not scenario.is_session_snapshot:
        return

    sessions = (
        await db.execute(
            select(models.GameSession).where(
                models.GameSession.scenario_id == scenario_id,
                models.GameSession.is_active == True,
            )
        )
    ).scalars().all()
    if not sessions:
        return

    from app.managers import master_connection_manager
    from app.managers.session_manager import session_manager

    connection_manager = master_connection_manager["session"]

    for gs in sessions:
        sid = str(gs.id)
        try:
            sm = await session_manager.ensure_manager(sid)
            if not await sm.session_exists():
                continue
            await sm.invalidate_entity_cache()
            extra: list[str] = []
            if "notes" in fields and hasattr(sm, "sync_dispatches_after_notes_change"):
                extra = await sm.sync_dispatches_after_notes_change()
            # Scenes embed location snapshots — refresh them whenever locations change.
            merged = list(fields)
            if "locations" in fields and "scenes" not in fields:
                merged.append("scenes")
            merged_fields = list(dict.fromkeys([*merged, *extra]))
            await sm.push_entity_updates(connection_manager, merged_fields)
        except Exception:
            logger.exception("notify_session_snapshot_entity_change failed session=%s", sid)
