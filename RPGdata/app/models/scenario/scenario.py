from sqlalchemy import Boolean, JSON, Column, Integer, String, DateTime, ForeignKey, UniqueConstraint, Uuid
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid

from ..validators import ValidatedURL
from app.infrastructure.database import Base

class Scenario(Base):
    __tablename__ = "scenario"
    
    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String, nullable=False)
    intro = Column(String)
    max_players = Column(Integer)
    created = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))

    rule_id_str = Column(String)

    icon_url = Column(ValidatedURL(256))

    user_id = Column(Uuid, ForeignKey("user.id"))

    scenario_starts_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))

    source_scenario_id = Column(Uuid, ForeignKey("scenario.id", ondelete="SET NULL"), nullable=True)
    is_session_snapshot = Column(Boolean, nullable=False, default=False)
    lifecycle_status = Column(String, nullable=True)  # running | closed (only snapshots)
    launch_mode = Column(String, nullable=True)  # single_party | multi_party

    data = Column(JSON)
    tags = Column(JSON)
    
    # Отношения
    user = relationship("User", back_populates="scenarios")
    items = relationship("GameItem", back_populates="scenario", cascade="all, delete-orphan")
    locations = relationship("Location", back_populates="scenario", cascade="all, delete-orphan")
    npcs = relationship("NPC", back_populates="scenario", cascade="all, delete-orphan")
    characters = relationship("PlayerCharacter", back_populates="scenario", cascade="all, delete-orphan")
    game_sessions = relationship(
        "GameSession",
        foreign_keys="GameSession.scenario_id",
        back_populates="scenario",
    )
    notes = relationship("Note", back_populates="scenario", cascade="all, delete-orphan")
    counters = relationship("Counter", back_populates="scenario", cascade="all, delete-orphan")
    gametimeevents = relationship("GameTimeEvent", back_populates="scenario", cascade="all, delete-orphan")
    master_group_accesses = relationship(
        "MasterGroupScenarioAccess",
        back_populates="scenario",
        cascade="all, delete-orphan",
    )
    story_beats = relationship("StoryBeat", back_populates="scenario", cascade="all, delete-orphan")
    obstacles = relationship("Obstacle", back_populates="scenario", cascade="all, delete-orphan")
    scene_exposures = relationship("SceneExposure", back_populates="scenario", cascade="all, delete-orphan")

    entity_pack_links = relationship(
        "ScenarioEntityPackLink",
        back_populates="scenario",
        cascade="all, delete-orphan",
    )
    name_pack_links = relationship(
        "ScenarioNamePackLink",
        back_populates="scenario",
        cascade="all, delete-orphan",
    )
    template_entity_links = relationship(
        "ScenarioTemplateEntityLink",
        back_populates="scenario",
        cascade="all, delete-orphan",
    )

    todos = relationship(
        "ScenarioTodo",
        back_populates="scenario",
        cascade="all, delete-orphan",
    )
    scenario_tags = relationship(
        "ScenarioTag",
        back_populates="scenario",
        cascade="all, delete-orphan",
    )
    fronts = relationship(
        "Front",
        back_populates="scenario",
        cascade="all, delete-orphan",
    )



