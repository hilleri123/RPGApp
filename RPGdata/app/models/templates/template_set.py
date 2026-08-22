from __future__ import annotations

import uuid
from sqlalchemy import Column, String, Boolean, Integer, ForeignKey, JSON, Uuid, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import relationship

from app.infrastructure.database import Base
from app.models.validators import ValidatedURL




class RuleTemplateSet(Base):
    """
    Набор шаблонов (фабрика).
    Может быть:
    - глобальный для rule (scenario_id is NULL)
    - дефолтный для конкретного scenario (scenario_id NOT NULL, is_default_for_scenario=True)
    """
    __tablename__ = "rule_template_set"
    __table_args__ = (
        UniqueConstraint("scenario_id", name="uq_rule_template_set_scenario_id"),
    )

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)

    # у тебя в Scenario это строка rule_id_str [file:98]
    rule_id_str = Column(String, nullable=False, index=True)

    # если set создан “для сценария”
    scenario_id = Column(Uuid, ForeignKey("scenario.id", ondelete="CASCADE"), nullable=True, index=True)

    name = Column(String, nullable=False)

    # relationships
    scenario = relationship("Scenario")  # без back_populates, чтобы не лезть в Scenario прямо сейчас

    item_templates = relationship("RuleItemTemplate", back_populates="template_set", cascade="all, delete-orphan")
    npc_templates = relationship("RuleNPCTemplate", back_populates="template_set", cascade="all, delete-orphan")
    character_templates = relationship("RuleCharacterTemplate", back_populates="template_set", cascade="all, delete-orphan")

    scenario_links = relationship("ScenarioTemplateSetLink", back_populates="template_set", cascade="all, delete-orphan")



