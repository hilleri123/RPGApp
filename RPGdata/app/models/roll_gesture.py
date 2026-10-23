from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, Uuid

from app.infrastructure.database import Base


class RollGesture(Base):
    """Один сделанный жест броска. Картинка лежит в media, в сессии только id."""

    __tablename__ = "roll_gesture"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    session_id = Column(Uuid, ForeignKey("game_session.id", ondelete="CASCADE"), nullable=True, index=True)
    user_id = Column(Uuid, ForeignKey("user.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    seed_hash = Column(String(64), nullable=True, index=True)
    image_ref = Column(String, nullable=True)
    reason = Column(Text, nullable=True)
    version = Column(Integer, nullable=False, default=1)
    changed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
