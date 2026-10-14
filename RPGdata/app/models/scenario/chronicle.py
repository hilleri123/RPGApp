from sqlalchemy import Column, DateTime, String, JSON, ForeignKey, Uuid, func
from sqlalchemy.orm import relationship
import uuid

from app.infrastructure.database import Base


class ChronicleLine(Base):
    __tablename__ = "chronicle_line"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    scenario_id = Column(Uuid, ForeignKey("scenario.id", ondelete="CASCADE"), nullable=False, index=True)
    kind = Column(String, nullable=False, index=True)
    text = Column(String, nullable=False, default="")
    subject_kind = Column(String, nullable=True)
    subject_id = Column(Uuid, nullable=True, index=True)
    real_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    game_time = Column(String, nullable=True)
    scene_id = Column(Uuid, nullable=True, index=True)
    scene_time = Column(String, nullable=True)
    location_id = Column(Uuid, nullable=True)
    payload = Column(JSON, nullable=True)
    author_user_id = Column(Uuid, ForeignKey("user.id", ondelete="SET NULL"), nullable=True)

    scenario = relationship("Scenario")
