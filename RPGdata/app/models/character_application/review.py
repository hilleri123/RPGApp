from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, Text, Boolean, ForeignKey, Uuid,
    DateTime, Enum as SAEnum, JSON,
)
from sqlalchemy.orm import relationship

from app.infrastructure.database import Base
from app.models.character_application import ApplicationStatus


class ApplicationReview(Base):
    """Один раунд обратной связи — мастера или игрока."""
    __tablename__ = "application_review"

    id             = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    application_id = Column(Uuid, ForeignKey("character_application.id", ondelete="CASCADE"),
                            nullable=False, index=True)
    author_id      = Column(Uuid, ForeignKey("user.id", ondelete="SET NULL"), nullable=True)

    status_set_to  = Column(SAEnum(ApplicationStatus), nullable=False)
    comment        = Column(Text, nullable=True)
    proposed_data  = Column(JSON, nullable=True)  # мастер предлагает правки статов
    is_player_note = Column(Boolean, nullable=False, default=False)  # True = ответ игрока

    created_at = Column(DateTime(timezone=True),
                        default=lambda: datetime.now(timezone.utc), nullable=False)

    application = relationship("CharacterApplication", back_populates="reviews")
    author      = relationship("User", foreign_keys=[author_id])