from sqlalchemy import Boolean, Column, Integer, JSON, String, ForeignKey, UniqueConstraint, Uuid
from sqlalchemy.orm import relationship
import uuid
from sqlalchemy.ext.associationproxy import association_proxy

from ..validators import ValidatedURL
from app.infrastructure.database import Base



class NPC(Base):
    __tablename__ = "npc"
    
    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    source_entity_id = Column(Uuid, ForeignKey("npc.id", ondelete="SET NULL"), nullable=True, index=True)
    copied_from = Column(Uuid, ForeignKey("npc.id", ondelete="SET NULL"), nullable=True, index=True)
    name = Column(String, nullable=False)
    description_for_master = Column(String)
    description_for_players = Column(String)

    data = Column(JSON, nullable=True)
    tags = Column(JSON)

    icon_url = Column(ValidatedURL(256))
    img_url = Column(ValidatedURL(256))

    scenario_id = Column(Uuid, ForeignKey("scenario.id", ondelete="CASCADE"), nullable=True)
    
    # Отношения
    scenario = relationship("Scenario", back_populates="npcs")  # Добавлено это отношение
    story_beats = relationship(
        "StoryBeat",
        secondary="story_beat_npc",
        back_populates="npcs",
    )
    scene_exposures = relationship("SceneExposure", secondary="scene_exposure_npc", back_populates="npcs")

    owned_item_links = relationship(
        "ItemOwnership",
        back_populates="npc",
        cascade="all, delete-orphan",
    )
    owned_items = association_proxy("owned_item_links", "item")
    scene_exposure_template_links = relationship(
        "SceneExposureTemplateNPC",
        back_populates="template_npc",
    )


