from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Text, Uuid
from sqlalchemy.orm import relationship

from app.infrastructure.database import Base


class RollRecord(Base):
    __tablename__ = "roll_record"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    session_id = Column(Uuid, ForeignKey("game_session.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Uuid, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    player_id = Column(Uuid, ForeignKey("player.id", ondelete="SET NULL"), nullable=True, index=True)
    character_id = Column(Uuid, nullable=True, index=True)
    action_id = Column(Uuid, nullable=True, index=True)
    action_key = Column(String, nullable=True, index=True)
    roll_kind = Column(String, nullable=False, default="dice.roll", index=True)
    system_id = Column(String, nullable=True, index=True)
    title = Column(String, nullable=True)
    expression = Column(String, nullable=True)
    dice = Column(JSON, nullable=False, default=list)
    total = Column(Integer, nullable=True)
    outcome = Column(Text, nullable=True)
    seed_hash = Column(String(64), nullable=True, index=True)
    seed_image_ref = Column(String, nullable=True)
    meta = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    session = relationship("GameSession", foreign_keys=[session_id])
    user = relationship("User", foreign_keys=[user_id])
