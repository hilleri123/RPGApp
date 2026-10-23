from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, Uuid

from app.infrastructure.database import Base


def _now():
    return datetime.now(timezone.utc)


class SessionSceneRow(Base):
    __tablename__ = "session_scene"

    id = Column(Uuid, primary_key=True)
    session_id = Column(Uuid, ForeignKey("game_session.id", ondelete="CASCADE"), nullable=False, index=True)
    body = Column(JSON, nullable=False)
    version = Column(Integer, nullable=False, default=1)
    changed_at = Column(DateTime(timezone=True), default=_now, nullable=False)


class SessionActionRow(Base):
    __tablename__ = "session_action"

    id = Column(Uuid, primary_key=True)
    session_id = Column(Uuid, ForeignKey("game_session.id", ondelete="CASCADE"), nullable=False, index=True)
    body = Column(JSON, nullable=False)
    version = Column(Integer, nullable=False, default=1)
    changed_at = Column(DateTime(timezone=True), default=_now, nullable=False)


class SessionLogRow(Base):
    __tablename__ = "session_log_line"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    session_id = Column(Uuid, ForeignKey("game_session.id", ondelete="CASCADE"), nullable=False, index=True)
    body = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False, index=True)


class SessionAudioQueueRow(Base):
    __tablename__ = "session_audio_queue"

    id = Column(Uuid, primary_key=True)
    session_id = Column(Uuid, ForeignKey("game_session.id", ondelete="CASCADE"), nullable=False, index=True)
    position = Column(Integer, nullable=False, default=0)
    body = Column(JSON, nullable=False)
    version = Column(Integer, nullable=False, default=1)
    changed_at = Column(DateTime(timezone=True), default=_now, nullable=False)
