from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from sqlalchemy import Enum as SAEnum
from sqlalchemy import Column, Integer, String, Uuid, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
import uuid
import enum

from app.infrastructure.database import Base

class GameSessionStatus(str, enum.Enum):
    active = "active"
    finished_ok = "finished_ok"
    finished_forced = "finished_forced"


class GameSession(Base):
    __tablename__ = "game_session"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String, index=True)
    description = Column(String, nullable=True)
    scenario_id = Column(Uuid, ForeignKey("scenario.id"))
    master_id = Column(Uuid, ForeignKey("user.id"))
    created_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))
    is_active = Column(Boolean, default=True)
    
    status = Column(SAEnum(GameSessionStatus), default=GameSessionStatus.active, nullable=False)
    finished_at = Column(DateTime(timezone=True), nullable=True)

    campaign_id = Column(Uuid, ForeignKey("campaign.id"), nullable=True, index=True)
    campaign_step_index = Column(Integer, nullable=True)
    prior_session_id = Column(Uuid, ForeignKey("game_session.id"), nullable=True)
    launched_scenario_id = Column(Uuid, ForeignKey("scenario.id"), nullable=True, index=True)
    party_id = Column(Uuid, ForeignKey("scenario_party.id"), nullable=True, index=True)

    # Отношения
    scenario = relationship("Scenario", foreign_keys=[scenario_id], back_populates="game_sessions")
    launched_scenario = relationship("Scenario", foreign_keys=[launched_scenario_id])
    party = relationship("ScenarioParty", foreign_keys=[party_id])
    master = relationship("User", back_populates="game_sessions")
    players = relationship("Player", back_populates="session")
    campaign = relationship("Campaign", back_populates="game_sessions")
    prior_session = relationship("GameSession", remote_side=[id], foreign_keys=[prior_session_id])


    @property
    def rule_id_str(self):
        sc = getattr(self, "scenario", None)
        return getattr(sc, "rule_id_str", None)
