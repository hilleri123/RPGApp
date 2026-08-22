from sqlalchemy import JSON, Column, Integer, String, Boolean, ForeignKey, Table, Uuid
from sqlalchemy.orm import relationship
from sqlalchemy.ext.associationproxy import association_proxy
import uuid

from ..validators import ValidatedURL
from app.infrastructure.database import Base


# --- many-to-many: сюжетный ход <-> локации ---
story_beat_location = Table(
    "story_beat_location",
    Base.metadata,
    Column("story_beat_id", Uuid, ForeignKey("story_beat.id", ondelete="CASCADE"), primary_key=True),
    Column("location_id", Uuid, ForeignKey("location.id", ondelete="CASCADE"), primary_key=True),
    
)

# --- many-to-many: сюжетный ход <-> NPC ---
story_beat_npc = Table(
    "story_beat_npc",
    Base.metadata,
    Column("story_beat_id", Uuid, ForeignKey("story_beat.id", ondelete="CASCADE"), primary_key=True),
    Column("npc_id", Uuid, ForeignKey("npc.id", ondelete="CASCADE"), primary_key=True),
    
)


class StoryBeat(Base):
    """
    Сюжетный ход (атомизированный отыгрыш).
    """
    __tablename__ = "story_beat"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    source_entity_id = Column(Uuid, ForeignKey("story_beat.id", ondelete="SET NULL"), nullable=True, index=True)

    scenario_id = Column(Uuid, ForeignKey("scenario.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String, nullable=False)

    order_num = Column(Integer, nullable=False, default=0)  # порядковый номер

    text_for_master = Column(String)        # текст для мастера
    text_for_players = Column(String)       # текст для игроков

    img_url = Column(ValidatedURL(256))
    tags = Column(JSON)

    parent_story_beat_id = Column(Uuid, ForeignKey("story_beat.id"), nullable=True, index=True)

    # --- relations ---
    scenario = relationship("Scenario", back_populates="story_beats")

    parent_story_beat = relationship(
        "StoryBeat",
        remote_side=[id],
        foreign_keys=[parent_story_beat_id],
        backref="child_story_beats",
    )

    locations = relationship(
        "Location",
        secondary=story_beat_location,
        back_populates="story_beats",
    )

    npcs = relationship(
        "NPC",
        secondary=story_beat_npc,
        back_populates="story_beats",
    )

    scene_exposures = relationship("SceneExposure", back_populates="story_beat", passive_deletes=True)
