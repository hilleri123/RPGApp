import uuid
from sqlalchemy import Column, String, ForeignKey, JSON, Uuid
from sqlalchemy.orm import relationship
from sqlalchemy.ext.associationproxy import association_proxy


from app.infrastructure.database import Base


class Obstacle(Base):
    __tablename__ = "obstacle"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    source_entity_id = Column(Uuid, ForeignKey("obstacle.id", ondelete="SET NULL"), nullable=True, index=True)

    scenario_id = Column(
        Uuid,
        ForeignKey("scenario.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name = Column(String, nullable=False)

    description_for_master = Column(String, nullable=True)
    description_for_players = Column(String, nullable=True)

    data = Column(JSON, nullable=True)
    tags = Column(JSON)

    scenario = relationship("Scenario", back_populates="obstacles")
    scene_exposures = relationship("SceneExposure", secondary="scene_exposure_obstacle", back_populates="obstacles")
