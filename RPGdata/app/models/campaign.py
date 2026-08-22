from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Uuid, ForeignKey, DateTime, Boolean, Integer, JSON, Text
from sqlalchemy.orm import relationship

from app.infrastructure.database import Base


class Campaign(Base):
    __tablename__ = "campaign"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=True)
    master_id = Column(Uuid, ForeignKey("user.id"), nullable=False, index=True)
    rule_id_str = Column(String, nullable=True)

    current_step_index = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    carryover_state = Column(JSON, nullable=True)

    prep_scenario_id = Column(Uuid, ForeignKey("scenario.id"), nullable=True, index=True)
    launched_scenario_id = Column(Uuid, ForeignKey("scenario.id"), nullable=True, index=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    master = relationship("User", back_populates="campaigns")
    scenario_links = relationship(
        "CampaignScenario",
        back_populates="campaign",
        cascade="all, delete-orphan",
        order_by="CampaignScenario.order_num",
    )
    game_sessions = relationship("GameSession", back_populates="campaign")


class CampaignScenario(Base):
    __tablename__ = "campaign_scenario"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    campaign_id = Column(Uuid, ForeignKey("campaign.id", ondelete="CASCADE"), nullable=False, index=True)
    scenario_id = Column(Uuid, ForeignKey("scenario.id", ondelete="CASCADE"), nullable=False, index=True)
    order_num = Column(Integer, nullable=False, default=0)
    title_override = Column(String, nullable=True)

    campaign = relationship("Campaign", back_populates="scenario_links")
    scenario = relationship("Scenario")
