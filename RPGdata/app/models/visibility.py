from __future__ import annotations

import uuid

from sqlalchemy import Column, String, UniqueConstraint, Uuid

from app.infrastructure.database import Base


class VisibilityMember(Base):
    """Зона видимости участника сессии: набор id, которые ему можно отдать."""

    __tablename__ = "visibility_member"
    __table_args__ = (
        UniqueConstraint(
            "session_id",
            "user_id",
            "object_type",
            "object_id",
            name="uq_visibility_member",
        ),
    )

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    session_id = Column(Uuid, nullable=False, index=True)
    user_id = Column(Uuid, nullable=False, index=True)
    object_type = Column(String(64), nullable=False)
    object_id = Column(Uuid, nullable=False, index=True)
