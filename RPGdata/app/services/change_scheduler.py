"""Шедулер процесса: раз в тик читает журнал и шлёт пачку id в свои сокеты."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from uuid import UUID

from sqlalchemy import select

from app.infrastructure.database import AsyncSessionLocal
from app.logger import logger
from app.models.object_change import ObjectChange

TICK_SEC = 0.1


@dataclass
class _Watch:
    session_id: UUID
    user_id: UUID
    role: str
    cursor: int = 0


@dataclass
class ChangeScheduler:
    watches: dict[tuple[UUID, UUID], _Watch] = field(default_factory=dict)
    dirty_sessions: set[UUID] = field(default_factory=set)
    _task: asyncio.Task | None = None
    _cursor_ready: bool = False

    def mark_dirty(self, session_id: UUID | str) -> None:
        self.dirty_sessions.add(UUID(str(session_id)))

    def watch(self, session_id: UUID | str, user_id: UUID | str, role: str, cursor: int) -> None:
        key = (UUID(str(session_id)), UUID(str(user_id)))
        self.watches[key] = _Watch(session_id=key[0], user_id=key[1], role=role, cursor=cursor)

    def unwatch(self, session_id: UUID | str, user_id: UUID | str) -> None:
        self.watches.pop((UUID(str(session_id)), UUID(str(user_id))), None)

    def start(self) -> None:
        if self._task is None:
            self._task = asyncio.create_task(self._loop())

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def _loop(self) -> None:
        while True:
            try:
                await asyncio.sleep(TICK_SEC)
                await self.tick()
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("change scheduler tick failed")

    async def tick(self) -> None:
        if not self.watches:
            return
        floor = min(watch.cursor for watch in self.watches.values())
        async with AsyncSessionLocal() as db:
            rows = (
                await db.execute(
                    select(ObjectChange)
                    .where(ObjectChange.id > floor)
                    .order_by(ObjectChange.id)
                    .limit(500)
                )
            ).scalars().all()
        if not rows and not self.dirty_sessions:
            return
        from app.managers import master_connection_manager, session_manager
        from app.services.visibility_service import load_visible_keys, rebuild_for_user

        for sid in {watch.session_id for watch in self.watches.values()}:
            manager = session_manager.managers.get(str(sid))
            if manager is not None and rows:
                await manager.invalidate_entity_cache()

        pending = set(self.dirty_sessions)
        self.dirty_sessions.clear()
        inventory_rows = any(row.object_type == "inventory" for row in rows)
        for watch in list(self.watches.values()):
            if watch.session_id in pending or inventory_rows:
                await rebuild_for_user(watch.session_id, watch.user_id, watch.role)
        if not rows:
            return
        newest = int(rows[-1].id)

        sockets = master_connection_manager["session"]
        visible_cache: dict[tuple[UUID, UUID], set[tuple[str, UUID]]] = {}
        for watch in list(self.watches.values()):
            mine = [row for row in rows if int(row.id) > watch.cursor]
            watch.cursor = max(watch.cursor, newest)
            if not mine:
                continue
            key = (watch.session_id, watch.user_id)
            if key not in visible_cache:
                visible_cache[key] = await load_visible_keys(watch.session_id, watch.user_id)
            zone = visible_cache[key]
            batch = []
            for row in mine:
                in_zone = (row.object_type, row.object_id) in zone
                if row.op == "gone":
                    if row.session_id != watch.session_id:
                        continue
                elif not in_zone:
                    continue
                batch.append(
                    {
                        "object_type": row.object_type,
                        "object_id": str(row.object_id),
                        "version": row.version,
                        "op": row.op,
                        "changed_at": row.changed_at.isoformat() if row.changed_at else None,
                    }
                )
            if not batch:
                continue
            await sockets.send_json(
                watch.user_id,
                {
                    "msg_type": "object_changes",
                    "session_id": str(watch.session_id),
                    "changes": batch,
                },
            )


scheduler = ChangeScheduler()


async def current_change_cursor() -> int:
    async with AsyncSessionLocal() as db:
        from sqlalchemy import func

        value = (await db.execute(select(func.max(ObjectChange.id)))).scalar()
    return int(value or 0)
