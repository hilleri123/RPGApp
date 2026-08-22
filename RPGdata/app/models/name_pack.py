from __future__ import annotations

import enum
import uuid

from sqlalchemy import Boolean, Column, ForeignKey, Integer, JSON, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import relationship

from app.infrastructure.database import Base


class NamePartKind(str, enum.Enum):
    given = "given"
    family = "family"
    nickname = "nickname"
    full = "full"


class NamePack(Base):
    """Пак частей имён — нарратив, без привязки к системе правил."""

    __tablename__ = "name_pack"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String, nullable=False)
    tags = Column(JSON, nullable=False, default=list, server_default="[]")

    entries = relationship(
        "NamePackEntry",
        back_populates="pack",
        cascade="all, delete-orphan",
        order_by="NamePackEntry.sort_order",
    )
    scenario_links = relationship(
        "ScenarioNamePackLink",
        back_populates="pack",
        cascade="all, delete-orphan",
    )


class NamePackEntry(Base):
    __tablename__ = "name_pack_entry"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    pack_id = Column(Uuid, ForeignKey("name_pack.id", ondelete="CASCADE"), nullable=False, index=True)
    text = Column(String, nullable=False)
    part_kind = Column(String, nullable=False, default=NamePartKind.full.value, index=True)
    tags = Column(JSON, nullable=False, default=list, server_default="[]")
    description = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)

    pack = relationship("NamePack", back_populates="entries")


class ScenarioNamePackLink(Base):
    __tablename__ = "scenario_name_pack_link"
    __table_args__ = (
        UniqueConstraint("scenario_id", "name_pack_id", name="uq_scenario_name_pack_link"),
    )

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    scenario_id = Column(Uuid, ForeignKey("scenario.id", ondelete="CASCADE"), nullable=False, index=True)
    name_pack_id = Column(Uuid, ForeignKey("name_pack.id", ondelete="CASCADE"), nullable=False, index=True)
    enabled = Column(Boolean, nullable=False, default=True)
    order_num = Column(Integer, nullable=False, default=0)

    pack = relationship("NamePack", back_populates="scenario_links")
    scenario = relationship("Scenario", back_populates="name_pack_links")
