from sqlalchemy import Boolean, Column, Integer, JSON, String, ForeignKey, UniqueConstraint, Uuid
from sqlalchemy.orm import relationship
import uuid
from sqlalchemy.ext.associationproxy import association_proxy

from ..validators import ValidatedURL
from app.infrastructure.database import Base


class PlayerCharacter(Base):
    __tablename__ = "player_character"
    
    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    source_entity_id = Column(Uuid, ForeignKey("player_character.id", ondelete="SET NULL"), nullable=True, index=True)
    copied_from = Column(Uuid, ForeignKey("player_character.id", ondelete="SET NULL"), nullable=True, index=True)
    name = Column(String, nullable=False)
    short_desc = Column(String)
    story = Column(String)

    data = Column(JSON, nullable=True)
    tags = Column(JSON)

    icon_url = Column(ValidatedURL(256))
    icon_path = Column(String)
    img_url = Column(ValidatedURL(256))
    img_path = Column(String)

    location_id = Column(Uuid, ForeignKey("location.id"))
    scenario_id = Column(Uuid, ForeignKey("scenario.id", ondelete="CASCADE"), nullable=True)
    # Stable link to the user who plays this character in the launched scenario / lobby prefill.
    bound_user_id = Column(Uuid, ForeignKey("user.id", ondelete="SET NULL"), nullable=True, index=True)

    # Отношения
    location = relationship("Location", back_populates="characters")
    scenario = relationship("Scenario", back_populates="characters")  # Добавлено это отношение
    # player = relationship("Player", back_populates="character")
    counters = relationship("Counter", back_populates="character")

    owned_item_links = relationship(
        "ItemOwnership",
        back_populates="character",
        cascade="all, delete-orphan",
    )
    owned_items = association_proxy("owned_item_links", "item")

