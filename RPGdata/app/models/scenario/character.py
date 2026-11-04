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
    # Stable link to the user who plays this character in the launched scenario / lobby prefill.
    bound_user_id = Column(Uuid, ForeignKey("user.id", ondelete="SET NULL"), nullable=True, index=True)

    # Отношения
    location = relationship("Location", back_populates="characters")
    scenario_links = relationship(
        "CharacterScenario",
        back_populates="character",
        cascade="all, delete-orphan",
    )
    counters = relationship("Counter", back_populates="character")

    owned_item_links = relationship(
        "ItemOwnership",
        back_populates="character",
        cascade="all, delete-orphan",
    )
    owned_items = association_proxy("owned_item_links", "item")


class CharacterScenario(Base):
    """Персонаж в сценарии. Один и тот же персонаж может состоять в нескольких."""

    __tablename__ = "character_scenario"

    character_id = Column(
        Uuid,
        ForeignKey("player_character.id", ondelete="CASCADE"),
        primary_key=True,
    )
    scenario_id = Column(
        Uuid,
        ForeignKey("scenario.id", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    )
    # native — родной для сценария; application — из заявки в лобби; other — иначе.
    origin = Column(String, nullable=False)

    character = relationship("PlayerCharacter", back_populates="scenario_links")
    scenario = relationship("Scenario", back_populates="character_links")

