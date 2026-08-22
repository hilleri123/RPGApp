from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, Text, ForeignKey, Uuid, DateTime,
)
from sqlalchemy.orm import relationship

from app.infrastructure.database import Base


class CharacterApplicationItem(Base):
    """
    Конкретный GameItem, выданный мастером в рамках заявки.
    Создаётся при одобрении ApplicationItemRequest (или вручную мастером).
    При финальном approve заявки переносится в ItemOwnership.
    """
    __tablename__ = "character_application_item"

    id             = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    application_id = Column(Uuid, ForeignKey("character_application.id", ondelete="CASCADE"),
                            nullable=False, index=True)
    item_id        = Column(Uuid, ForeignKey("game_item.id", ondelete="CASCADE"),
                            nullable=False)

    # Опционально: из какого запроса возник предмет
    item_request_id = Column(Uuid, ForeignKey("application_item_request.id", ondelete="SET NULL"),
                             nullable=True)

    master_comment = Column(Text, nullable=True)
    granted_at     = Column(DateTime(timezone=True),
                            default=lambda: datetime.now(timezone.utc), nullable=False)
    granted_by_id  = Column(Uuid, ForeignKey("user.id", ondelete="SET NULL"), nullable=True)

    application  = relationship("CharacterApplication", back_populates="granted_items")
    item         = relationship("GameItem")
    item_request = relationship("ApplicationItemRequest", back_populates="granted_item_link")
    granted_by   = relationship("User", foreign_keys=[granted_by_id])