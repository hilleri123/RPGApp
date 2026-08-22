from __future__ import annotations

import uuid

from sqlalchemy import Column, ForeignKey, Integer, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import relationship

from ..validators import ValidatedURL
from app.infrastructure.database import Base


FRONT_ENTITY_TYPES = ("npc", "story_beat", "item", "counter", "location")


class Front(Base):
    """Master-only 'force of the world' grouping NPCs, beats, items, counters, locations."""

    __tablename__ = "front"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    scenario_id = Column(
        Uuid, ForeignKey("scenario.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name = Column(String, nullable=False)
    description_for_master = Column(Text, nullable=True)
    color = Column(String, nullable=False, default="#7c3aed")
    icon_url = Column(ValidatedURL(256))
    tag_id = Column(
        Uuid, ForeignKey("scenario_tag.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    scenario = relationship("Scenario", back_populates="fronts")
    tag = relationship(
        "ScenarioTag",
        foreign_keys=[tag_id],
        post_update=True,
    )
    owned_tag = relationship(
        "ScenarioTag",
        back_populates="front",
        foreign_keys="ScenarioTag.front_id",
        uselist=False,
    )
    members = relationship(
        "FrontMember",
        back_populates="front",
        cascade="all, delete-orphan",
    )
    wiki_notes = relationship(
        "FrontWikiNote",
        back_populates="front",
        cascade="all, delete-orphan",
        order_by="FrontWikiNote.sort_order",
    )


class FrontMember(Base):
    __tablename__ = "front_member"
    __table_args__ = (
        UniqueConstraint(
            "front_id", "entity_type", "entity_id", name="uq_front_member_entity"
        ),
    )

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    front_id = Column(
        Uuid, ForeignKey("front.id", ondelete="CASCADE"), nullable=False, index=True
    )
    entity_type = Column(String, nullable=False)  # npc|story_beat|item|counter|location
    entity_id = Column(Uuid, nullable=False, index=True)

    front = relationship("Front", back_populates="members")


class FrontWikiNote(Base):
    """Link a master_wiki Note as a Front 'event' / info page."""

    __tablename__ = "front_wiki_note"
    __table_args__ = (
        UniqueConstraint("front_id", "note_id", name="uq_front_wiki_note"),
    )

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    front_id = Column(
        Uuid, ForeignKey("front.id", ondelete="CASCADE"), nullable=False, index=True
    )
    note_id = Column(
        Uuid, ForeignKey("note.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sort_order = Column(Integer, nullable=False, default=0)

    front = relationship("Front", back_populates="wiki_notes")
    note = relationship("Note")
