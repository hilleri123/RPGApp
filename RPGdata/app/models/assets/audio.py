from __future__ import annotations
import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, JSON, String, Uuid
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.infrastructure.database import Base


class AudioTrack(Base):
    __tablename__ = "audio_track"

    id          = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)
    name        = Column(String, nullable=False)
    description = Column(String, nullable=True)
    url         = Column(String, nullable=False)

    duration    = Column(Integer, nullable=True)   # секунды, заполняется при загрузке если есть
    file_size   = Column(Integer, nullable=True)   # байты
    mime_type   = Column(String,  nullable=True)

    tags        = Column(JSON, nullable=True)

    created_by  = Column(Uuid, ForeignKey("user.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at  = Column(DateTime, server_default=func.now(), nullable=False)

    # обратная связь через association object
    exposure_links = relationship(
        "SceneExposureAudio",
        back_populates="audio_track",
        cascade="all, delete-orphan",
    )


class SceneExposureAudio(Base):
    """
    Связь экспозиции с треком, с настройками воспроизведения.
    Отдельная таблица вместо простой M2M, чтобы хранить volume/loop/fade per-exposure.
    """
    __tablename__ = "scene_exposure_audio"

    scene_exposure_id = Column(
        Uuid, ForeignKey("scene_exposure.id", ondelete="CASCADE"), primary_key=True
    )
    audio_track_id = Column(
        Uuid, ForeignKey("audio_track.id",    ondelete="CASCADE"), primary_key=True
    )

    volume    = Column(Float,   nullable=False, default=0.5)
    loop      = Column(Boolean, nullable=False, default=True)
    fade_in   = Column(Float,   nullable=False, default=2.0)   # секунды
    fade_out  = Column(Float,   nullable=False, default=2.0)
    order_num = Column(Integer, nullable=False, default=0)

    scene_exposure = relationship("SceneExposure", back_populates="audio_tracks")
    audio_track    = relationship("AudioTrack",    back_populates="exposure_links")