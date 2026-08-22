from __future__ import annotations

import uuid
from sqlalchemy import Column, String, Boolean, Integer, ForeignKey, JSON, Uuid, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.ext.associationproxy import association_proxy

from app.infrastructure.database import Base
from app.models.validators import ValidatedURL


class RuleCharacterTemplate(Base):
    __tablename__ = "rule_character_template"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)

    template_set_id = Column(
        Uuid,
        ForeignKey("rule_template_set.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name = Column(String, nullable=False)
    short_desc = Column(String)
    story = Column(String)
    data = Column(JSON, nullable=True)
    tags = Column(JSON)
    icon_url = Column(ValidatedURL(256))
    img_url = Column(ValidatedURL(256))

    template_set = relationship("RuleTemplateSet", back_populates="character_templates")

    owned_item_links = relationship(
        "RuleItemOwnershipTemplate",
        foreign_keys="[RuleItemOwnershipTemplate.character_template_id]",
        back_populates="character_template",
        cascade="all, delete-orphan",
    )

    owned_items = association_proxy("owned_item_links", "item_template")
