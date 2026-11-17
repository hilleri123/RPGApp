"""Авторы иконок Flaticon, которые реально скачали на эту площадку."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Integer, String

from app.infrastructure.database import Base


class FlaticonCredit(Base):
    __tablename__ = "flaticon_credit"

    icon_id = Column(Integer, primary_key=True)
    author_name = Column(String(200), nullable=False)
    author_url = Column(String(512), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
