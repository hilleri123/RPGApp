"""Сдача уже записанного файла в SpeechKit и запись реплик."""

from __future__ import annotations

import asyncio
from datetime import timedelta
from uuid import UUID

from sqlalchemy import select, update

from app import models
from app.infrastructure.database import AsyncSessionLocal
from app.services.speechkit import recognize_file
from app.services.table_session import MEDIA_ROOT, game_time_at, marks_for_session


async def transcribe_segment(segment_id: UUID) -> None:
    async with AsyncSessionLocal() as db:
        claimed = await db.execute(
            update(models.TableSegment)
            .where(
                models.TableSegment.id == segment_id,
                models.TableSegment.status.in_(("pending", "error")),
            )
            .values(status="transcribing", error=None)
        )
        if claimed.rowcount == 0:
            return
        await db.commit()

        path = MEDIA_ROOT / segment.file_path
        try:
            phrases = await asyncio.to_thread(recognize_file, path)
        except Exception as exc:
            segment = await db.get(models.TableSegment, segment_id)
            if segment is not None:
                segment.status = "error"
                segment.error = str(exc)
                await db.commit()
            return

        segment = await db.get(models.TableSegment, segment_id)
        table = await db.get(models.TableSession, segment.table_session_id)
        marks = await marks_for_session(db, table.game_session_id)
        for phrase in phrases:
            start = segment.real_started_at + timedelta(milliseconds=max(phrase.start_ms, 0))
            end_ms = phrase.end_ms if phrase.end_ms > phrase.start_ms else phrase.start_ms
            end = segment.real_started_at + timedelta(milliseconds=max(end_ms, 0))
            db.add(models.TableUtterance(
                table_session_id=segment.table_session_id,
                segment_id=segment.id,
                participant_id=segment.participant_id,
                text=phrase.text,
                confidence=phrase.confidence,
                real_started_at=start,
                real_ended_at=end,
                game_time=game_time_at(marks, start),
                provider="speechkit",
            ))
        segment.status = "ready"
        segment.error = None
        if table.left_at is not None:
            pending = (await db.execute(
                select(models.TableSegment.id).where(
                    models.TableSegment.table_session_id == table.id,
                    models.TableSegment.status.in_(("pending", "transcribing")),
                    models.TableSegment.id != segment.id,
                )
            )).first()
            table.status = "transcribing" if pending else "ready"
        await db.commit()


async def pending_segment_ids() -> list[UUID]:
    async with AsyncSessionLocal() as db:
        rows = (await db.execute(
            select(models.TableSegment.id).where(models.TableSegment.status == "pending")
        )).scalars().all()
        return list(rows)
