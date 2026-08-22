from __future__ import annotations

import uuid
from sqlalchemy import Column, String, Boolean, Integer, ForeignKey, JSON, Uuid, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.ext.associationproxy import association_proxy

from app.infrastructure.database import Base
from app.models.validators import ValidatedURL


class RuleNPCTemplate(Base):
    __tablename__ = "rule_npc_template"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)

    template_set_id = Column(
        Uuid,
        ForeignKey("rule_template_set.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name = Column(String, nullable=False)
    description_for_master = Column(String)
    description_for_players = Column(String)
    data = Column(JSON, nullable=True)
    tags = Column(JSON)
    icon_url = Column(ValidatedURL(256))
    img_url = Column(ValidatedURL(256))

    template_set = relationship("RuleTemplateSet", back_populates="npc_templates")

    owned_item_links = relationship(
        "RuleItemOwnershipTemplate",
        foreign_keys="[RuleItemOwnershipTemplate.npc_template_id]",
        back_populates="npc_template",
        cascade="all, delete-orphan",
    )

    owned_items = association_proxy("owned_item_links", "item_template")
    scene_exposure_links = relationship(
        "SceneExposureTemplateNPC",
        back_populates="template_npc",
    )