import uuid

from sqlalchemy import JSON, Column, String, ForeignKey, Integer, Table, Uuid, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.ext.associationproxy import association_proxy


from app.infrastructure.database import Base


# M2M: exposure <-> location/npc/item/obstacle
scene_exposure_npc = Table(
    "scene_exposure_npc",
    Base.metadata,
    Column("scene_exposure_id", Uuid, ForeignKey("scene_exposure.id", ondelete="CASCADE"), primary_key=True),
    Column("npc_id", Uuid, ForeignKey("npc.id", ondelete="CASCADE"), primary_key=True),
    
)

scene_exposure_item = Table(
    "scene_exposure_item",
    Base.metadata,
    Column("scene_exposure_id", Uuid, ForeignKey("scene_exposure.id", ondelete="CASCADE"), primary_key=True),
    Column("item_id", Uuid, ForeignKey("game_item.id", ondelete="CASCADE"), primary_key=True),
    
)

class SceneExposureTemplateNPC(Base):
    __tablename__ = "scene_exposure_template_npc"

    id                = Column(Uuid, primary_key=True, default=uuid.uuid4)
    scene_exposure_id = Column(Uuid, ForeignKey("scene_exposure.id", ondelete="CASCADE"), nullable=False, index=True)
    template_npc_id   = Column(Uuid, ForeignKey("npc.id", ondelete="CASCADE"), nullable=False)
    qty               = Column(Integer, nullable=False, default=1)

    scene_exposure = relationship("SceneExposure", back_populates="template_npc_links")
    template_npc   = relationship("NPC", back_populates="scene_exposure_template_links")


class SceneExposureTemplateItem(Base):
    __tablename__ = "scene_exposure_template_item"

    id                = Column(Uuid, primary_key=True, default=uuid.uuid4)
    scene_exposure_id = Column(Uuid, ForeignKey("scene_exposure.id", ondelete="CASCADE"), nullable=False, index=True)
    template_item_id  = Column(Uuid, ForeignKey("game_item.id", ondelete="CASCADE"), nullable=False)
    qty               = Column(Integer, nullable=False, default=1)

    scene_exposure = relationship("SceneExposure", back_populates="template_item_links")
    template_item  = relationship("GameItem", back_populates="scene_exposure_template_links")


scene_exposure_obstacle = Table(
    "scene_exposure_obstacle",
    Base.metadata,
    Column("scene_exposure_id", Uuid, ForeignKey("scene_exposure.id", ondelete="CASCADE"), primary_key=True),
    Column("obstacle_id", Uuid, ForeignKey("obstacle.id", ondelete="CASCADE"), primary_key=True),
    
)


class SceneExposure(Base):
    __tablename__ = "scene_exposure"
    __table_args__ = (
        # XOR: ровно одно из location_id / story_beat_id должно быть задано [web:842]
        CheckConstraint(
            "(location_id IS NULL) <> (story_beat_id IS NULL)",
            name="scene_exposure_location_xor_story_beat",
        ),
    )

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    source_entity_id = Column(Uuid, ForeignKey("scene_exposure.id", ondelete="SET NULL"), nullable=True, index=True)

    scenario_id = Column(
        Uuid,
        ForeignKey("scenario.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name = Column(String, nullable=False)
    order_num = Column(Integer, nullable=False, default=0)
    tags = Column(JSON)

    location_id = Column(Uuid, ForeignKey("location.id", ondelete="CASCADE"), nullable=True, index=True)
    story_beat_id = Column(Uuid, ForeignKey("story_beat.id", ondelete="CASCADE"), nullable=True, index=True)

    scenario = relationship("Scenario", back_populates="scene_exposures")

    location = relationship("Location", back_populates="scene_exposures")
    story_beat = relationship("StoryBeat", back_populates="scene_exposures")


    template_npc_links = relationship(
        "SceneExposureTemplateNPC",
        back_populates="scene_exposure",
        cascade="all, delete-orphan",
    )
    template_item_links = relationship(
        "SceneExposureTemplateItem",
        back_populates="scene_exposure",
        cascade="all, delete-orphan",
    )

    npcs = relationship("NPC", secondary=scene_exposure_npc, back_populates="scene_exposures")
    items = relationship("GameItem", secondary=scene_exposure_item, back_populates="scene_exposures")
    obstacles = relationship("Obstacle", secondary=scene_exposure_obstacle, back_populates="scene_exposures")
    
    template_npcs  = association_proxy("template_npc_links",  "template_npc")
    template_items = association_proxy("template_item_links", "template_item")

    audio_tracks = relationship(
        "SceneExposureAudio",
        back_populates="scene_exposure",
        cascade="all, delete-orphan",
        order_by="SceneExposureAudio.order_num",
    )