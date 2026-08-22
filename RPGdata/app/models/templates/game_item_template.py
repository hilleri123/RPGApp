from __future__ import annotations

import uuid
from sqlalchemy import Column, String, Boolean, Integer, ForeignKey, JSON, Uuid, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.ext.associationproxy import association_proxy

from app.infrastructure.database import Base
from app.models.validators import ValidatedURL


class RuleItemTemplate(Base):
    __tablename__ = "rule_item_template"

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
    icon_url = Column(ValidatedURL(256))
    img_url = Column(ValidatedURL(256))
    data = Column(JSON, nullable=True)
    tags = Column(JSON)
    quest_html_mark = Column(String)

    template_set = relationship("RuleTemplateSet", back_populates="item_templates")

    # links inside templates:
    owned_by_links = relationship(
        "RuleItemOwnershipTemplate",
        foreign_keys="[RuleItemOwnershipTemplate.item_template_id]",
        back_populates="item_template",
        cascade="all, delete-orphan",
        uselist=True,
    )
    contained_item_links = relationship(
        "RuleItemContainedTemplate",
        foreign_keys="[RuleItemContainedTemplate.owner_item_template_id]",
        back_populates="owner_item_template",
        cascade="all, delete-orphan",
        uselist=True,
    )
    scene_exposure_links = relationship(
        "SceneExposureTemplateItem",
        back_populates="template_item",
    )