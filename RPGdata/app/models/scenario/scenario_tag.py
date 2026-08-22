from __future__ import annotations

import uuid

from sqlalchemy import Column, ForeignKey, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import relationship

from app.infrastructure.database import Base


class ScenarioTag(Base):
    """Pooled tags for a scenario (manual or auto-created for a Front)."""

    __tablename__ = "scenario_tag"
    __table_args__ = (
        UniqueConstraint("scenario_id", "key", name="uq_scenario_tag_scenario_key"),
    )

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    scenario_id = Column(
        Uuid, ForeignKey("scenario.id", ondelete="CASCADE"), nullable=False, index=True
    )
    key = Column(String, nullable=False, index=True)
    label = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String, nullable=True)
    kind = Column(String, nullable=False, default="manual")  # manual | front
    front_id = Column(
        Uuid, ForeignKey("front.id", ondelete="SET NULL", use_alter=True, name="fk_scenario_tag_front_id"),
        nullable=True,
        index=True,
    )

    scenario = relationship("Scenario", back_populates="scenario_tags")
    front = relationship(
        "Front",
        back_populates="owned_tag",
        foreign_keys=[front_id],
    )
