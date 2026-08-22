from sqlalchemy import Boolean, Column, Integer, String, ForeignKey, JSON, Uuid
from sqlalchemy.orm import relationship
import uuid
from sqlalchemy.ext.associationproxy import association_proxy

from app.infrastructure.database import Base
from ..validators import ValidatedURL



class GameItem(Base):
    __tablename__ = "game_item"
    
    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    source_entity_id = Column(Uuid, ForeignKey("game_item.id", ondelete="SET NULL"), nullable=True, index=True)
    copied_from = Column(Uuid, ForeignKey("game_item.id", ondelete="SET NULL"), nullable=True, index=True)
    name = Column(String, nullable=False)
    description_for_master = Column(String)
    description_for_players = Column(String)

    icon_url = Column(ValidatedURL(256))
    img_url = Column(ValidatedURL(256))

    data = Column(JSON, nullable=True)
    tags = Column(JSON)
    quest_html_mark = Column(String)

    scenario_id = Column(Uuid, ForeignKey("scenario.id", ondelete="CASCADE"), nullable=True)

    # Отношения
    scenario = relationship("Scenario", back_populates="items")

    scene_exposures = relationship("SceneExposure", secondary="scene_exposure_item", back_populates="items")

    ownership_link = relationship(
        "ItemOwnership",
        foreign_keys="[ItemOwnership.item_id]",
        back_populates="item",
        uselist=False,
        cascade="all, delete-orphan",
    )

    contained_item_links = relationship(
        "ItemOwnership",
        foreign_keys="[ItemOwnership.owner_item_id]",
        back_populates="owner_item",
        cascade="all, delete-orphan",
    )

    contained_items = association_proxy("contained_item_links", "item")
    scene_exposure_template_links = relationship(
        "SceneExposureTemplateItem",
        back_populates="template_item",
    )

