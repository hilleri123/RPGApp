from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, UniqueConstraint, Uuid

from app.infrastructure.database import Base


class Inventory(Base):
    """Сумка со своим id. Кто ей пользуется — список участников, не один владелец."""

    __tablename__ = "inventory"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    scenario_id = Column(Uuid, ForeignKey("scenario.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False, default="")
    membership_token = Column(Uuid, nullable=False, default=uuid.uuid4)
    version = Column(Integer, nullable=False, default=1)
    changed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class InventoryParticipant(Base):
    __tablename__ = "inventory_participant"
    __table_args__ = (
        UniqueConstraint(
            "inventory_id",
            "participant_type",
            "participant_id",
            name="uq_inventory_participant",
        ),
    )

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    inventory_id = Column(Uuid, ForeignKey("inventory.id", ondelete="CASCADE"), nullable=False, index=True)
    participant_type = Column(String(32), nullable=False)
    participant_id = Column(Uuid, nullable=False, index=True)


class InventoryItem(Base):
    __tablename__ = "inventory_item"
    __table_args__ = (
        UniqueConstraint("item_id", name="uq_inventory_item_item"),
    )

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    inventory_id = Column(Uuid, ForeignKey("inventory.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(Uuid, ForeignKey("game_item.id", ondelete="CASCADE"), nullable=False)
    qty = Column(Integer, nullable=False, default=1)
    equipped = Column(Boolean, nullable=False, default=False)
