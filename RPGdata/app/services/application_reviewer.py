"""Who may be assigned to review a character application."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app import models


def application_visible_to_master(reviewer_id: UUID | None, master_id: UUID) -> bool:
    """Мастер видит свои заявки и старые, у которых проверяющий не назначен."""
    return reviewer_id is None or reviewer_id == master_id


async def require_master_reviewer(db: AsyncSession, reviewer_id: UUID | None) -> UUID | None:
    if reviewer_id is None:
        return None
    user = await db.get(models.User, reviewer_id)
    if user is None or not user.can_be_master or user.is_active is False:
        raise HTTPException(status_code=400, detail="Проверяющим может быть только мастер")
    return user.id
