from sqlalchemy import Column, DateTime, Integer, String, JSON, ForeignKey, Uuid, func
from sqlalchemy.orm import relationship
import uuid

from ..validators import ValidatedURL
from app.infrastructure.database import Base


class Note(Base):
    __tablename__ = "note"
    
    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    source_entity_id = Column(Uuid, ForeignKey("note.id", ondelete="SET NULL"), nullable=True, index=True)
    parent_note_id = Column(Uuid, ForeignKey("note.id", ondelete="SET NULL"), nullable=True, index=True)
    sort_order = Column(Integer, nullable=False, default=0, server_default="0")
    name = Column(String, nullable=False)
    text = Column(String)  # XML в виде строки
    allowed_character_shown_json = Column(JSON)
    tags = Column(JSON)
    owner_user_id = Column(Uuid, nullable=True)
    owner_role = Column(String, nullable=True)

    icon_url = Column(ValidatedURL(256))
    img_url = Column(ValidatedURL(256))

    scenario_id = Column(Uuid, ForeignKey("scenario.id", ondelete="CASCADE"))
    
    # Отношения
    scenario = relationship("Scenario", back_populates="notes")
    time_events = relationship("GameTimeEvent", back_populates="note")
    parent = relationship(
        "Note",
        remote_side=[id],
        foreign_keys=[parent_note_id],
        backref="children",
    )


class Counter(Base):
    __tablename__ = "counter"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    source_entity_id = Column(Uuid, ForeignKey("counter.id", ondelete="SET NULL"), nullable=True, index=True)

    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    tags = Column(JSON)

    value = Column(Integer, default=0, nullable=False)
    min_value = Column(Integer, nullable=True)
    max_value = Column(Integer, nullable=True)

    # Привязка
    scenario_id = Column(Uuid, ForeignKey("scenario.id", ondelete="CASCADE"), nullable=False)
    character_id = Column(Uuid, ForeignKey("player_character.id", ondelete="CASCADE"), nullable=True)

    # Отношения
    scenario = relationship("Scenario", back_populates="counters")
    character = relationship("PlayerCharacter", back_populates="counters")
    changes = relationship(
        "CounterChange",
        back_populates="counter",
        cascade="all, delete-orphan",
        order_by="CounterChange.created_at.desc()",
    )


class CounterChange(Base):
    __tablename__ = "counter_change"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    counter_id = Column(Uuid, ForeignKey("counter.id", ondelete="CASCADE"), nullable=False, index=True)
    delta = Column(Integer, nullable=False)
    old_value = Column(Integer, nullable=False)
    new_value = Column(Integer, nullable=False)
    comment = Column(String, nullable=True)
    user_id = Column(Uuid, ForeignKey("user.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    counter = relationship("Counter", back_populates="changes")


class GameTimeEvent(Base):
    __tablename__ = "game_time_event"
    
    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String, nullable=False)
    text = Column(String)  # XML в виде строки
    start_time = Column(DateTime)
    end_time = Column(DateTime)

    icon_url = Column(ValidatedURL(256))
    img_url = Column(ValidatedURL(256))

    note_id = Column(Uuid, ForeignKey("note.id"), nullable=True)
    scenario_id = Column(Uuid, ForeignKey("scenario.id", ondelete="CASCADE"))

    # Отношения
    scenario = relationship("Scenario", back_populates="gametimeevents")
    note = relationship("Note", back_populates="time_events")