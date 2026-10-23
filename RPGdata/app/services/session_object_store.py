"""Сцены, ходы, логи и очередь звука живут в Postgres, не в Redis-документе."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError

from app.infrastructure.database import AsyncSessionLocal
from app.models.object_change import ObjectChange
from app.models.session_object import (
    SessionActionRow,
    SessionAudioQueueRow,
    SessionLogRow,
    SessionSceneRow,
)

_KIND = {
    "scenes": (SessionSceneRow, "scene"),
    "actions": (SessionActionRow, "action"),
    "audio_queue": (SessionAudioQueueRow, "audio_queue"),
    "logs": (SessionLogRow, "log"),
}


def _as_dict(raw: Any) -> dict | None:
    if hasattr(raw, "model_dump"):
        raw = raw.model_dump(mode="json")
    if isinstance(raw, dict) and raw.get("id"):
        return raw
    return None


def _obstacle_ids(side: dict) -> list:
    ids = list(side.get("obstacle_ids") or [])
    if ids:
        return ids
    for ob in side.get("obstacles") or []:
        if isinstance(ob, dict) and ob.get("id"):
            ids.append(ob["id"])
        elif hasattr(ob, "id"):
            ids.append(str(ob.id))
    return ids


def normalize_scene_body(raw: dict) -> dict:
    """SceneInner: персонажи и NPC уже id. Препятствиям дописываем obstacle_ids."""
    body = dict(raw)
    for key in ("public", "private"):
        side = dict(body.get(key) or {})
        side["obstacle_ids"] = [str(i) for i in _obstacle_ids(side)]
        body[key] = side
    return body


class SessionObjectStore:
    def __init__(self, session_id: str):
        self.session_id = UUID(str(session_id))

    async def load(self, field: str) -> list[dict] | None:
        model, _ = _KIND[field]
        async with AsyncSessionLocal() as db:
            rows = (
                await db.execute(select(model).where(model.session_id == self.session_id))
            ).scalars().all()
        if not rows:
            return None
        rows = sorted(rows, key=lambda row: (row.body or {}).get("_position", getattr(row, "position", 0) or 0))
        out = []
        for row in rows:
            body = dict(row.body or {})
            body.pop("_position", None)
            out.append(body)
        return out

    async def save(self, field: str, value: Any, _retry: bool = True) -> None:
        model, object_type = _KIND[field]
        items = value if isinstance(value, list) else []
        bodies: list[dict] = []
        for index, raw in enumerate(items):
            body = _as_dict(raw)
            if body is None:
                continue
            if field == "scenes":
                body = normalize_scene_body(body)
            body["_position"] = index
            bodies.append(body)

        async with AsyncSessionLocal() as db:
            existing = (
                await db.execute(select(model).where(model.session_id == self.session_id))
            ).scalars().all()
            by_id = {row.id: row for row in existing}
            seen: set[UUID] = set()
            for body in bodies:
                oid = UUID(str(body["id"]))
                seen.add(oid)
                row = by_id.get(oid)
                if row is None:
                    kwargs = {"id": oid, "session_id": self.session_id, "body": body}
                    if field == "audio_queue":
                        kwargs["position"] = body["_position"]
                    db.add(model(**kwargs))
                    continue
                if row.body != body or (field == "audio_queue" and row.position != body["_position"]):
                    row.body = body
                    if field == "audio_queue":
                        row.position = body["_position"]
                    if field == "logs":
                        db.add(
                            ObjectChange(
                                object_type=object_type,
                                object_id=oid,
                                version=1,
                                op="updated",
                                session_id=self.session_id,
                            )
                        )
            for row in existing:
                if row.id not in seen:
                    db.add(
                        ObjectChange(
                            object_type=object_type,
                            object_id=row.id,
                            version=getattr(row, "version", 1) or 1,
                            op="gone",
                            session_id=self.session_id,
                        )
                    )
                    await db.delete(row)
            try:
                await db.commit()
            except IntegrityError:
                await db.rollback()
                if not _retry:
                    raise
                await self.save(field, value, _retry=False)

    async def delete_session_rows(self) -> None:
        async with AsyncSessionLocal() as db:
            for model, _ in _KIND.values():
                await db.execute(delete(model).where(model.session_id == self.session_id))
            await db.commit()
