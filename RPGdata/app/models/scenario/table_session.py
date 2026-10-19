"""Стол в Переговорке: участники, файлы, реплики, черновик истории."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import BigInteger, Boolean, Column, DateTime, Float, ForeignKey, JSON, String, Text, Uuid

from app.infrastructure.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class GameTimeMark(Base):
    """Пара «реальное время → игровое» на смене часов сессии."""

    __tablename__ = "game_time_mark"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    session_id = Column(Uuid, ForeignKey("game_session.id", ondelete="CASCADE"), nullable=False, index=True)
    real_at = Column(DateTime(timezone=True), nullable=False, default=_now, index=True)
    game_time = Column(String, nullable=False)


class TableSession(Base):
    __tablename__ = "table_session"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    game_session_id = Column(Uuid, ForeignKey("game_session.id", ondelete="CASCADE"), nullable=True, index=True)
    lobby_id = Column(Uuid, nullable=True, index=True)
    preview = Column(Boolean, nullable=False, default=False, server_default="false")
    room_url = Column(String, nullable=False)
    domain = Column(String, nullable=False)
    room_code = Column(String, nullable=False)
    password = Column(String, nullable=True)
    status = Column(String, nullable=False, default="joining")
    status_detail = Column(Text, nullable=True)
    music_enabled = Column(Boolean, nullable=False, default=False)
    auto_connect = Column(Boolean, nullable=False, default=False, server_default="false")
    test_requested = Column(Boolean, nullable=False, default=False)
    test_report = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    joined_at = Column(DateTime(timezone=True), nullable=True)
    left_at = Column(DateTime(timezone=True), nullable=True)


class TableParticipant(Base):
    __tablename__ = "table_participant"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    table_session_id = Column(Uuid, ForeignKey("table_session.id", ondelete="CASCADE"), nullable=False, index=True)
    jitsi_id = Column(String, nullable=False)
    display_name = Column(String, nullable=False, default="")
    character_id = Column(Uuid, ForeignKey("player_character.id", ondelete="SET NULL"), nullable=True)
    bind_kind = Column(String, nullable=False, default="", server_default="")
    observer_code = Column(String, nullable=True)
    live_bytes = Column(BigInteger, nullable=False, default=0, server_default="0")
    live_seconds = Column(Float, nullable=False, default=0, server_default="0")


class TableSegment(Base):
    __tablename__ = "table_segment"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    table_session_id = Column(Uuid, ForeignKey("table_session.id", ondelete="CASCADE"), nullable=False, index=True)
    participant_id = Column(Uuid, ForeignKey("table_participant.id", ondelete="CASCADE"), nullable=False, index=True)
    file_path = Column(String, nullable=False)
    real_started_at = Column(DateTime(timezone=True), nullable=False)
    real_ended_at = Column(DateTime(timezone=True), nullable=False)
    status = Column(String, nullable=False, default="pending")
    error = Column(Text, nullable=True)


class TableUtterance(Base):
    __tablename__ = "table_utterance"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    table_session_id = Column(Uuid, ForeignKey("table_session.id", ondelete="CASCADE"), nullable=False, index=True)
    segment_id = Column(Uuid, ForeignKey("table_segment.id", ondelete="CASCADE"), nullable=False, index=True)
    participant_id = Column(Uuid, ForeignKey("table_participant.id", ondelete="SET NULL"), nullable=True)
    text = Column(Text, nullable=False, default="")
    confidence = Column(Float, nullable=True)
    real_started_at = Column(DateTime(timezone=True), nullable=False)
    real_ended_at = Column(DateTime(timezone=True), nullable=False)
    game_time = Column(String, nullable=True)
    provider = Column(String, nullable=False, default="speechkit")


class TableMusicSpan(Base):
    """Какой файл играл в комнате и какой кусок, без копии самого трека."""

    __tablename__ = "table_music_span"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    table_session_id = Column(Uuid, ForeignKey("table_session.id", ondelete="CASCADE"), nullable=False, index=True)
    path = Column(String, nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=False)
    ended_at = Column(DateTime(timezone=True), nullable=False)
    position_start = Column(Float, nullable=False, default=0)
    position_end = Column(Float, nullable=False, default=0)


class TableRecap(Base):
    __tablename__ = "table_recap"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    table_session_id = Column(Uuid, ForeignKey("table_session.id", ondelete="CASCADE"), nullable=False, index=True)
    text = Column(Text, nullable=False, default="")
    images = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)
