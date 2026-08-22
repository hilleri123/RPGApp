from __future__ import annotations

import uuid
from sqlalchemy import Column, String, Boolean, Integer, ForeignKey, JSON, Uuid, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import relationship

from app.infrastructure.database import Base
from app.models.validators import ValidatedURL


class RuleItemOwnershipTemplate(Base):
    """
    Template-аналог ItemOwnership [file:97], но:
    - owner может быть только character_template или npc_template (можно расширить)
    - item_id -> item_template_id
    - никаких ссылок на реальные scenario сущности
    """
    __tablename__ = "rule_item_ownership_template"
    __table_args__ = (
        CheckConstraint(
            "((character_template_id IS NOT NULL)::int + (npc_template_id IS NOT NULL)::int) = 1",
            name="ck_rule_item_owner_exactly_one",
        ),
    )

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)

    item_template_id = Column(
        Uuid, ForeignKey("rule_item_template.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # owner
    character_template_id = Column(
        Uuid, ForeignKey("rule_character_template.id", ondelete="CASCADE"), nullable=True, index=True
    )
    npc_template_id = Column(
        Uuid, ForeignKey("rule_npc_template.id", ondelete="CASCADE"), nullable=True, index=True
    )

    owner_item_template_id = Column(
        Uuid, ForeignKey("rule_item_template.id", ondelete="CASCADE"), nullable=False, index=True
    )

    qty = Column(Integer, nullable=False, default=1)
    equipped = Column(Boolean, nullable=False, default=False)

    item_template = relationship("RuleItemTemplate", foreign_keys=[item_template_id], back_populates="owned_by_links")

    character_template = relationship("RuleCharacterTemplate", back_populates="owned_item_links")
    npc_template = relationship("RuleNPCTemplate", back_populates="owned_item_links")
    owner_item_template = relationship("RuleItemTemplate", foreign_keys=[owner_item_template_id], back_populates="owned_by_links")


class RuleItemContainedTemplate(Base):
    """
    Template-аналог “item contains item” через owner_item_id в ItemOwnership [file:97],
    но храним как отдельную таблицу template->template.
    """
    __tablename__ = "rule_item_contained_template"
    __table_args__ = (
        UniqueConstraint("owner_item_template_id", "item_template_id", name="uq_rule_item_contained_pair"),
    )

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)

    owner_item_template_id = Column(
        Uuid, ForeignKey("rule_item_template.id", ondelete="CASCADE"), nullable=False, index=True
    )
    item_template_id = Column(
        Uuid, ForeignKey("rule_item_template.id", ondelete="CASCADE"), nullable=False, index=True
    )

    qty = Column(Integer, nullable=False, default=1)

    owner_item_template = relationship(
        "RuleItemTemplate",
        foreign_keys=[owner_item_template_id],
        back_populates="contained_item_links",
    )
    item_template = relationship("RuleItemTemplate", foreign_keys=[item_template_id])