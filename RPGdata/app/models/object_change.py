from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import BigInteger, Column, DateTime, Integer, String, Uuid

from app.infrastructure.database import Base


class ObjectChange(Base):
    """Очередь доставки: id объекта, версия и время. Тела объекта здесь нет."""

    __tablename__ = "object_change"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    object_type = Column(String(64), nullable=False, index=True)
    object_id = Column(Uuid, nullable=False, index=True)
    version = Column(Integer, nullable=False, default=1)
    changed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    op = Column(String(16), nullable=False, default="updated")
    session_id = Column(Uuid, nullable=True, index=True)
