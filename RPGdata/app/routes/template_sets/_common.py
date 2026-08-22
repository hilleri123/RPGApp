# app/routes/template_sets/_common.py
from __future__ import annotations

from uuid import UUID

from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.infrastructure.database import get_async_session as get_db
from app.services.template_entities import get_pack_or_404

# Backward-compatible alias: template_set_id in URL == entity pack id
RuleTemplateSet = models.EntityPack


async def get_template_set_or_404(
    template_set_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> models.EntityPack:
    return await get_pack_or_404(db, template_set_id)
