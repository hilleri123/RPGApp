from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Text, ForeignKey, Uuid,
    DateTime, Enum as SAEnum,
)
from sqlalchemy.orm import relationship

from app.infrastructure.database import Base


class ItemRequestStatus(str, enum.Enum):
    pending  = "pending"
    approved = "approved"
    rejected = "rejected"
    modified = "modified"  # одобрено с заменой предмета


class ApplicationItemRequest(Base):
    """Пожелание игрока по шаблону предмета."""
    __tablename__ = "application_item_request"

    id             = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    application_id = Column(Uuid, ForeignKey("character_application.id", ondelete="CASCADE"),
                            nullable=False, index=True)

    # Что хочет игрок
    requested_item_id = Column(Uuid, ForeignKey("game_item.id", ondelete="SET NULL"),
                               nullable=True)
    requested_name    = Column(String, nullable=True)  # если предмета нет в каталоге
    player_comment    = Column(Text, nullable=True)

    # Решение мастера
    status         = Column(SAEnum(ItemRequestStatus), nullable=False,
                            default=ItemRequestStatus.pending)
    master_comment = Column(Text, nullable=True)
    decided_at     = Column(DateTime(timezone=True), nullable=True)
    decided_by_id  = Column(Uuid, ForeignKey("user.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime(timezone=True),
                        default=lambda: datetime.now(timezone.utc), nullable=False)

    application    = relationship("CharacterApplication", back_populates="item_requests")
    requested_item = relationship("GameItem", foreign_keys=[requested_item_id])
    decided_by     = relationship("User", foreign_keys=[decided_by_id])

    # Выданный предмет — через отдельную таблицу (один запрос → один выданный предмет)
    granted_item_link = relationship(
        "CharacterApplicationItem",
        back_populates="item_request",
        uselist=False,
    )