"""Location library: search across the user's scenarios + import into a scenario/session."""

from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.auth import require_master
from app.auth.permissions import PERM_READ
from app.constants.location_kinds import LOCATION_KINDS
from app.infrastructure.database import get_async_session as get_db
from app.routes._helpers import (
    get_scenario_edit,
    notify_active_sessions_for_scenario,
    require_scenario_by_id,
)
from app.services import location_library as svc

router = APIRouter(tags=["location_library"])


class LibraryLocationOut(BaseModel):
    id: UUID
    name: str
    kind: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    is_template: bool = False
    scenario_id: UUID
    scenario_name: str
    parent_location_name: Optional[str] = None
    children_count: int = 0
    icon_url: Optional[str] = None
    map_url: Optional[str] = None
    snippet: str = ""


class KindOut(BaseModel):
    id: str
    title: str


class ImportLocationIn(BaseModel):
    source_location_id: UUID
    include_children: bool = True
    parent_location_id: Optional[UUID] = None


class ImportLocationOut(BaseModel):
    location_id: UUID
    created_ids: List[UUID]


@router.get("/location_library/kinds", response_model=List[KindOut])
async def list_kinds(current_user: models.User = Depends(require_master)):
    return [KindOut(id=k, title=t) for k, t in LOCATION_KINDS]


@router.get("/location_library", response_model=List[LibraryLocationOut])
async def search_locations(
    q: Optional[str] = None,
    kinds: Optional[str] = Query(None, description="Через запятую: city,apartment"),
    tags: Optional[str] = Query(None, description="Через запятую, все должны совпасть"),
    scenario_id: Optional[UUID] = None,
    templates_only: bool = False,
    rule_id_str: Optional[str] = None,
    limit: int = 40,
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    hits = await svc.search_library(
        db,
        current_user,
        q=q,
        kinds=[k.strip() for k in (kinds or "").split(",") if k.strip()],
        tags=[t.strip() for t in (tags or "").split(",") if t.strip()],
        scenario_id=scenario_id,
        templates_only=templates_only,
        rule_id_str=rule_id_str,
        limit=limit,
    )
    return [LibraryLocationOut(**h.__dict__) for h in hits]


@router.post(
    "/scenarios/{scenario_id}/locations/import",
    response_model=ImportLocationOut,
    status_code=status.HTTP_201_CREATED,
)
async def import_location(
    data: ImportLocationIn,
    scenario: models.Scenario = Depends(get_scenario_edit),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    """Clone a location (with sublocations) from any readable scenario into this one."""
    source = await db.get(models.Location, data.source_location_id)
    if source is None or source.scenario_id is None:
        raise HTTPException(status_code=404, detail="Локация не найдена")
    # Копировать можно только из сценария, который пользователь вправе читать.
    await require_scenario_by_id(db, current_user, source.scenario_id, PERM_READ)

    try:
        result = await svc.import_location(
            db,
            source_location_id=data.source_location_id,
            target_scenario=scenario,
            parent_location_id=data.parent_location_id,
            include_children=data.include_children,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail="Локация не найдена") from exc

    await db.commit()
    await notify_active_sessions_for_scenario(db, scenario, ["locations", "scenes"])
    return ImportLocationOut(location_id=result.root_id, created_ids=result.created_ids)
