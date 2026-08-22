from __future__ import annotations

import enum
import uuid

from sqlalchemy import (
    Boolean,
    Column,
    ForeignKey,
    Integer,
    JSON,
    String,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import relationship

from app.infrastructure.database import Base


class EntityKindEnum(str, enum.Enum):
    npc = "npc"
    game_item = "game_item"
    player_character = "player_character"


class EntityPack(Base):
    """
    Пак шаблонных сущностей (глобальный для rule_id_str).
    Не привязан к сценарию — сценарий подключает паки через ScenarioEntityPackLink.
    """

    __tablename__ = "entity_pack"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    rule_id_str = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    tags = Column(JSON, nullable=False, default=list, server_default="[]")

    members = relationship(
        "EntityPackMember",
        back_populates="pack",
        cascade="all, delete-orphan",
    )
    scenario_links = relationship(
        "ScenarioEntityPackLink",
        back_populates="pack",
        cascade="all, delete-orphan",
    )


class EntityPackMember(Base):
    __tablename__ = "entity_pack_member"
    __table_args__ = (
        UniqueConstraint("pack_id", "entity_kind", "entity_id", name="uq_entity_pack_member"),
    )

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    pack_id = Column(Uuid, ForeignKey("entity_pack.id", ondelete="CASCADE"), nullable=False, index=True)
    entity_kind = Column(String, nullable=False, index=True)
    entity_id = Column(Uuid, nullable=False, index=True)

    pack = relationship("EntityPack", back_populates="members")


class ScenarioEntityPackLink(Base):
    """Сценарий использует пак шаблонов."""

    __tablename__ = "scenario_entity_pack_link"
    __table_args__ = (
        UniqueConstraint("scenario_id", "pack_id", name="uq_scenario_entity_pack_link"),
    )

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    scenario_id = Column(Uuid, ForeignKey("scenario.id", ondelete="CASCADE"), nullable=False, index=True)
    pack_id = Column(Uuid, ForeignKey("entity_pack.id", ondelete="CASCADE"), nullable=False, index=True)
    enabled = Column(Boolean, nullable=False, default=True)
    order_num = Column(Integer, nullable=False, default=0)
    tags = Column(JSON)

    scenario = relationship("Scenario", back_populates="entity_pack_links")
    pack = relationship("EntityPack", back_populates="scenario_links")


class ScenarioTemplateEntityLink(Base):
    """Сценарий использует отдельную шаблонную сущность (не через пак)."""

    __tablename__ = "scenario_template_entity_link"
    __table_args__ = (
        UniqueConstraint(
            "scenario_id",
            "entity_kind",
            "entity_id",
            name="uq_scenario_template_entity_link",
        ),
    )

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    scenario_id = Column(Uuid, ForeignKey("scenario.id", ondelete="CASCADE"), nullable=False, index=True)
    entity_kind = Column(String, nullable=False, index=True)
    entity_id = Column(Uuid, nullable=False, index=True)
    enabled = Column(Boolean, nullable=False, default=True)
    order_num = Column(Integer, nullable=False, default=0)

    scenario = relationship("Scenario", back_populates="template_entity_links")
