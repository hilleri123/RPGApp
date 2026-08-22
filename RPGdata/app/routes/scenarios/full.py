from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.infrastructure.database import get_async_session as get_db
from app.infrastructure import s3_service
from app import models, scheme
from app.auth import require_master
from app.auth.permissions import PERM_READ
from app.crud import crud_stmt_scenario
from app.routes.scenarios.access import require_scenario_access

router = APIRouter(prefix="/scenarios", tags=["scenarios"])


@router.get("/full/{scenario_id}", response_model=scheme.FullScenario)
async def read_scenario(
    scenario_id: UUID,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db)
):
    """Получить сценарий по ID"""
    result = await db.execute(crud_stmt_scenario().where(models.Scenario.id == scenario_id))
    db_scenario = result.scalars().first()
    if db_scenario is None:
        raise HTTPException(status_code=404, detail="Сценарий не найден")
    await require_scenario_access(db, current_user, db_scenario, PERM_READ)
    return db_scenario
