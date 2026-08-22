# app/models/item_ownership.py (или куда ты складываешь модели scenario)

import enum
import uuid

from sqlalchemy import (
    Column, Integer, Boolean, func, ForeignKey, UniqueConstraint, CheckConstraint, Uuid, String
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.ext.associationproxy import association_proxy

from app.infrastructure.database import Base


class OwnerTypeEnum(str, enum.Enum):
    character = "character"
    npc = "npc"
    item = "item"  # если предмет может быть контейнером для других предметов


class ItemOwnership(Base):
    __tablename__ = "item_ownership"
    __table_args__ = (
        # один и тот же item не должен одновременно быть у двух владельцев
        UniqueConstraint("item_id", name="uq_item_ownership_item"),
        # защита: ровно одно из полей owner_* задано
        CheckConstraint(
            "(character_id IS NOT NULL)::int + (npc_id IS NOT NULL)::int + (owner_item_id IS NOT NULL)::int = 1",
            name="ck_item_ownership_exactly_one_owner",
        ),
    )

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)

    item_id = Column(Uuid, ForeignKey("game_item.id", ondelete="CASCADE"), nullable=False)

    # владелец (ровно один)
    character_id = Column(Uuid, ForeignKey("player_character.id", ondelete="CASCADE"), nullable=True)
    npc_id = Column(Uuid, ForeignKey("npc.id", ondelete="CASCADE"), nullable=True)
    owner_item_id = Column(Uuid, ForeignKey("game_item.id", ondelete="CASCADE"), nullable=True)

    qty = Column(Integer, nullable=False, default=1)
    equipped = Column(Boolean, nullable=False, default=False)

    # relationships
    item = relationship("GameItem", foreign_keys=[item_id], back_populates="ownership_link")

    character = relationship("PlayerCharacter", back_populates="owned_item_links")
    npc = relationship("NPC", back_populates="owned_item_links")

    # если предмет может содержать другие предметы
    owner_item = relationship("GameItem", foreign_keys=[owner_item_id], back_populates="contained_item_links")
