from sqlalchemy import Column, Integer, Float, String, JSON, Boolean, ForeignKey, Uuid
from sqlalchemy.orm import relationship
import uuid
from sqlalchemy.ext.associationproxy import association_proxy

from ..validators import ValidatedURL
from app.infrastructure.database import Base

class Location(Base):
    __tablename__ = "location"
    
    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    source_entity_id = Column(Uuid, ForeignKey("location.id", ondelete="SET NULL"), nullable=True, index=True)
    name = Column(String, nullable=False)
    description_for_master = Column(String)
    description_for_players = Column(String)
    is_shown = Column(Boolean, default=False)
    is_start = Column(Boolean, default=False)

    icon_url = Column(ValidatedURL(256))
    icon_path = Column(String)
    map_url = Column(ValidatedURL(256))
    image_map_path = Column(String)
    map_width = Column(Integer, nullable=True)
    map_height = Column(Integer, nullable=True)
    excalidraw_map_json = Column(JSON)
    sh3d_map_path = Column(String)

    extra_images = Column(JSON)

    data = Column(JSON, nullable=True)
    tags = Column(JSON)

    parent_location_id = Column(Uuid, ForeignKey("location.id"), nullable=True)
    scenario_id = Column(Uuid, ForeignKey("scenario.id", ondelete="CASCADE"))
    
    # Отношения
    scenario = relationship("Scenario", back_populates="locations")
    parent_location = relationship(
        "Location",
        remote_side=[id],
        foreign_keys=[parent_location_id],
        backref="child_locations",
    )
    map_objects = relationship("MapObjectPolygon", foreign_keys="[MapObjectPolygon.source_location_id]", back_populates="source_location")
    target_objects = relationship("MapObjectPolygon", foreign_keys="[MapObjectPolygon.target_location_id]", back_populates="target_location")
    characters = relationship("PlayerCharacter", back_populates="location")
    story_beats = relationship(
        "StoryBeat",
        secondary="story_beat_location",
        back_populates="locations",
    )
    scene_exposures = relationship("SceneExposure", back_populates="location", passive_deletes=True)


    # костыль пока
    @property
    def map_type(self) -> str:
        if self.image_map_path or self.map_url:
            return "image"
        if self.excalidraw_map_json:
            return "excalidraw"
        if self.sh3d_map_path:
            return "sh3d"
        return None
    
    @property
    def parent_location_name(self) -> str:
        if self.parent_location:
            return self.parent_location.name
        return None


class MapObjectPolygon(Base):
    __tablename__ = "map_object_polygon"
    
    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    source_entity_id = Column(Uuid, ForeignKey("map_object_polygon.id", ondelete="SET NULL"), nullable=True, index=True)
    name = Column(String, nullable=False)
    source_location_id = Column(Uuid, ForeignKey("location.id", ondelete="CASCADE"))
    target_location_id = Column(Uuid, ForeignKey("location.id"), nullable=True)

    internal_id = Column(String)

    is_shown = Column(Boolean, default=True)
    is_filled = Column(Boolean, default=False)
    is_line = Column(Boolean, default=False)
    alpha = Column(Float)
    color = Column(String)
    polygon_list = Column(JSON)

    icon = Column(String)
    icon_url = Column(ValidatedURL(256))  # URL к иконке
    
    # Отношения
    source_location = relationship("Location", foreign_keys=[source_location_id], back_populates="map_objects")
    target_location = relationship("Location", foreign_keys=[target_location_id], back_populates="target_objects")
