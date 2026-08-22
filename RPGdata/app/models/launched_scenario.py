"""Launched scenario parties and per-player seen state."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Uuid, ForeignKey, DateTime, JSON, UniqueConstraint, Integer
from sqlalchemy.orm import relationship

from app.infrastructure.database import Base
from app.scheme.seen import SeenDataAccess


class ScenarioParty(Base):
    __tablename__ = "scenario_party"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    launched_scenario_id = Column(
        Uuid, ForeignKey("scenario.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name = Column(String, nullable=False)
    filter_tags = Column(JSON, nullable=False, default=list)
    sort_order = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    members = relationship(
        "ScenarioPartyMember",
        back_populates="party",
        cascade="all, delete-orphan",
    )


class ScenarioPartyMember(Base):
    __tablename__ = "scenario_party_member"
    __table_args__ = (
        UniqueConstraint("party_id", "user_id", name="uq_scenario_party_member"),
    )

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    party_id = Column(Uuid, ForeignKey("scenario_party.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Uuid, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)

    party = relationship("ScenarioParty", back_populates="members")


class PlayerSeenState(Base):
    __tablename__ = "player_seen_state"
    __table_args__ = (
        UniqueConstraint("launched_scenario_id", "user_id", name="uq_player_seen_launched_user"),
    )

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    launched_scenario_id = Column(
        Uuid, ForeignKey("scenario.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id = Column(Uuid, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    seen_ids = Column(JSON, nullable=False, default=list)  # legacy; use PlayerSeen rows
    polygon_shown_ids = Column(JSON, nullable=False, default=list)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class PlayerSeen(Base):
    """Per-player discovered entities (canonical id — template parent or entity itself)."""

    __tablename__ = "player_seen"
    __table_args__ = (
        UniqueConstraint(
            "launched_scenario_id",
            "user_id",
            "entity_type",
            "entity_id",
            name="uq_player_seen_entry",
        ),
    )

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    launched_scenario_id = Column(
        Uuid, ForeignKey("scenario.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id = Column(Uuid, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    entity_type = Column(String, nullable=False)
    entity_id = Column(Uuid, nullable=False, index=True)
    data_access = Column(
        String,
        nullable=False,
        default=SeenDataAccess.NONE.value,
        server_default=SeenDataAccess.NONE.value,
    )
    first_seen_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
