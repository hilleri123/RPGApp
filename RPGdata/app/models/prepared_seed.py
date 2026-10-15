from __future__ import annotations

import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Text, Uuid, func

from app.infrastructure.database import Base


class PreparedRollSeed(Base):
    """Нарисованный заранее жест броска. Очередь одного игрока этой сессии."""

    __tablename__ = "prepared_roll_seed"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    player_id = Column(Uuid, ForeignKey("player.id", ondelete="CASCADE"), nullable=False, index=True)
    position = Column(Integer, nullable=False, default=0)
    image = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
