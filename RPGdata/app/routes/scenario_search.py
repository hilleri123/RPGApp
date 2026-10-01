"""GET /scenarios/{id}/search — one box to find anything in a scenario."""

from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.auth import require_master
from app.infrastructure.database import get_async_session as get_db
from app.routes._helpers import get_scenario_or_404
from app.services import scenario_search as svc

router = APIRouter(prefix="/scenarios/{scenario_id}/search", tags=["scenario_search"])


class SearchHitOut(BaseModel):
    type: str
    id: UUID
    name: str
    snippet: str = ""
    tags: List[str] = Field(default_factory=list)
    kind: Optional[str] = None


@router.get("", response_model=List[SearchHitOut])
@router.get("/", response_model=List[SearchHitOut], include_in_schema=False)
async def search(
    q: Optional[str] = None,
    types: Optional[str] = Query(None, description=f"Через запятую: {','.join(svc.SEARCH_TYPES)}"),
    tags: Optional[str] = Query(None, description="Через запятую, должны совпасть все"),
    limit: int = 50,
    scenario: models.Scenario = Depends(get_scenario_or_404),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    hits = await svc.search_scenario(
        db,
        scenario.id,
        q=q,
        types=[t.strip() for t in (types or "").split(",") if t.strip()] or None,
        tags=[t.strip() for t in (tags or "").split(",") if t.strip()],
        limit=limit,
    )
    return [SearchHitOut(**{k: getattr(h, k) for k in SearchHitOut.model_fields}) for h in hits]
