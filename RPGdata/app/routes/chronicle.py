"""Хроника сценария: строки со штампом времени и места."""

from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.auth import get_current_user, require_master
from app.infrastructure.database import get_async_session as get_db
from app.routes._helpers import get_scenario_edit, get_scenario_read, notify_active_sessions_for_scenario
from app.services import chronicle as svc

router = APIRouter(prefix="/scenarios/{scenario_id}/chronicle", tags=["chronicle"])


class ChronicleLineOut(BaseModel):
    id: UUID
    scenario_id: UUID
    kind: str
    text: str = ""
    subject_kind: Optional[str] = None
    subject_id: Optional[UUID] = None
    real_at: Optional[Any] = None
    game_time: Optional[str] = None
    scene_id: Optional[UUID] = None
    scene_time: Optional[str] = None
    location_id: Optional[UUID] = None
    payload: dict = Field(default_factory=dict)
    author_user_id: Optional[UUID] = None


class ChronicleCreate(BaseModel):
    kind: str
    text: str = ""
    subject_kind: Optional[str] = None
    subject_id: Optional[UUID] = None
    payload: dict = Field(default_factory=dict)
    scene_id: Optional[UUID] = None
    render: bool = True


class ChronicleUpdate(BaseModel):
    text: Optional[str] = None
    payload: Optional[dict] = None


async def _stamp_for_scenario(db: AsyncSession, scenario_id: UUID, scene_id: UUID | None) -> dict:
    sessions = (
        await db.execute(
            select(models.GameSession).where(
                models.GameSession.scenario_id == scenario_id,
                models.GameSession.is_active == True,
            )
        )
    ).scalars().all()
    if not sessions:
        return {}
    from app.managers.session_manager import session_manager

    for gs in sessions:
        try:
            sm = await session_manager.ensure_manager(str(gs.id))
            if not await sm.session_exists():
                continue
            inner = await sm.get_inner()
            return svc.stamp_from_inner(inner, scene_id)
        except Exception:
            continue
    return {}


@router.get("", response_model=list[ChronicleLineOut])
async def list_chronicle(
    subject_id: Optional[UUID] = None,
    kinds: Optional[str] = Query(None, description="Через запятую, например plugin:dw:xp"),
    scene_id: Optional[UUID] = None,
    all: bool = Query(False, alias="all"),
    scenario: models.Scenario = Depends(get_scenario_read),
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    kind_list = [part.strip() for part in (kinds or "").split(",") if part.strip()] or None
    is_master = bool(current_user.can_be_master or current_user.is_admin)
    rows = await svc.list_lines(
        db,
        scenario.id,
        subject_id=subject_id,
        kinds=kind_list,
        scene_id=scene_id,
        allow_all=bool(all) and is_master,
    )
    return [ChronicleLineOut(**svc.line_out(row)) for row in rows]


@router.post("", response_model=ChronicleLineOut)
async def create_chronicle_line(
    body: ChronicleCreate,
    scenario: models.Scenario = Depends(get_scenario_edit),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    stamp = await _stamp_for_scenario(db, scenario.id, body.scene_id)
    row = await svc.record_line(
        db,
        scenario.id,
        kind=body.kind,
        text=body.text,
        subject_kind=body.subject_kind,
        subject_id=body.subject_id,
        payload=body.payload,
        author_user_id=current_user.id,
        stamp=stamp,
        render=body.render,
    )
    return ChronicleLineOut(**svc.line_out(row))


@router.patch("/{line_id}", response_model=ChronicleLineOut)
async def patch_chronicle_line(
    line_id: UUID,
    body: ChronicleUpdate,
    scenario: models.Scenario = Depends(get_scenario_edit),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    row, xp_delta = await svc.update_line(
        db,
        scenario.id,
        line_id,
        text=body.text,
        payload=body.payload,
    )
    if row is None:
        raise HTTPException(404, "Строка хроники не найдена")
    if xp_delta and row.subject_id:
        await svc.apply_xp_delta(db, scenario.id, row.subject_id, xp_delta)
        await notify_active_sessions_for_scenario(db, scenario, ["characters"])
    return ChronicleLineOut(**svc.line_out(row))
