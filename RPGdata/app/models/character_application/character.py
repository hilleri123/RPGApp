from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Text, Boolean, ForeignKey, Uuid,
    DateTime, Enum as SAEnum, JSON,
)
from sqlalchemy.orm import relationship

from app.infrastructure.database import Base
from app.models.validators import ValidatedURL


class ApplicationStatus(str, enum.Enum):
    draft         = "draft"          # игрок ещё заполняет
    submitted     = "submitted"      # отправил мастеру
    in_review     = "in_review"      # мастер смотрит
    needs_changes = "needs_changes"  # мастер попросил доработать
    approved      = "approved"       # одобрено, персонаж создан
    rejected      = "rejected"       # отклонено
    # after         = "after"          # появился после сессии


class CharacterApplication(Base):
    __tablename__ = "character_application"

    id      = Column(Uuid, primary_key=True, default=uuid.uuid4, index=True)

    # ── Привязка ──────────────────────────────────────────────────────────────
    user_id     = Column(Uuid, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    rule_id_str = Column(String, nullable=False, index=True)

    # ── Персонаж, придуманный игроком ─────────────────────────────────────────
    name       = Column(String, nullable=False)
    short_desc = Column(String, nullable=True)
    story      = Column(Text, nullable=True)
    tags       = Column(JSON, nullable=True)
    data       = Column(JSON, nullable=True)

    icon_url  = Column(ValidatedURL(256), nullable=True)
    icon_path = Column(String, nullable=True)
    img_url   = Column(ValidatedURL(256), nullable=True)
    img_path  = Column(String, nullable=True)

    player_comment = Column(Text, nullable=True)

    # ── Статус ────────────────────────────────────────────────────────────────
    status       = Column(SAEnum(ApplicationStatus), nullable=False,
                          default=ApplicationStatus.draft, index=True)
    created_at   = Column(DateTime(timezone=True),
                          default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at   = Column(DateTime(timezone=True),
                          default=lambda: datetime.now(timezone.utc),
                          onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    submitted_at = Column(DateTime(timezone=True), nullable=True)

    source_kind = Column(String, nullable=True)      # manual | session_result | imported
    source_session_id = Column(Uuid, ForeignKey("game_session.id"), nullable=True)
    source_player_id = Column(Uuid, ForeignKey("player.id"), nullable=True)
    is_result_snapshot = Column(Boolean, nullable=False, default=False)

    player_character_id = Column(
        Uuid,
        ForeignKey("player_character.id", ondelete="SET NULL"),
        nullable=True,
        unique=True,
        index=True,
    )

    # ── Отношения ─────────────────────────────────────────────────────────────
    user = relationship("User", back_populates="character_applications")
    player_character = relationship("PlayerCharacter", foreign_keys=[player_character_id])

    reviews = relationship(
        "ApplicationReview",
        back_populates="application",
        cascade="all, delete-orphan",
        order_by="ApplicationReview.created_at",
    )
    item_requests = relationship(
        "ApplicationItemRequest",
        back_populates="application",
        cascade="all, delete-orphan",
    )
    granted_items = relationship(
        "CharacterApplicationItem",
        back_populates="application",
        cascade="all, delete-orphan",
    )