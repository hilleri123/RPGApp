"""Запас жестов игрока этой сессии: список, добавление, удаление, порядок."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.auth import get_current_user
from app.infrastructure.database import get_async_session as get_db
from app.services import prepared_seeds as svc

router = APIRouter(prefix="/sessions/{session_id}/prepared-seeds", tags=["prepared-seeds"])


class PreparedSeedOut(BaseModel):
    id: UUID
    position: int
    image: str
    created_at: datetime | None = None


class PreparedSeedCreate(BaseModel):
    image: str


class PreparedSeedReorder(BaseModel):
    ids: list[UUID] = Field(default_factory=list)


def _out(row: models.PreparedRollSeed) -> PreparedSeedOut:
    return PreparedSeedOut(
        id=row.id,
        position=int(row.position or 0),
        image=row.image,
        created_at=row.created_at,
    )


async def _own_player(
    session_id: UUID,
    current_user: models.User,
    db: AsyncSession,
) -> UUID:
    player_id = await svc.player_id_for(db, session_id, current_user.id)
    if player_id is None:
        raise HTTPException(status_code=404, detail="Вы не игрок этой сессии")
    return player_id


@router.get("", response_model=list[PreparedSeedOut])
@router.get("/", response_model=list[PreparedSeedOut])
async def list_prepared_seeds(
    session_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    player_id = await _own_player(session_id, current_user, db)
    rows = await svc.list_seeds(db, player_id)
    return [_out(row) for row in rows]


@router.post("", response_model=PreparedSeedOut)
@router.post("/", response_model=PreparedSeedOut)
async def add_prepared_seed(
    session_id: UUID,
    body: PreparedSeedCreate,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    player_id = await _own_player(session_id, current_user, db)
    try:
        row = await svc.append_seed(db, player_id, body.image)
    except svc.PreparedSeedError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _out(row)


@router.delete("/{seed_id}")
async def delete_prepared_seed(
    session_id: UUID,
    seed_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    player_id = await _own_player(session_id, current_user, db)
    deleted = await svc.delete_seed(db, player_id, seed_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Жест не найден")
    return {"ok": True}


@router.put("/reorder", response_model=list[PreparedSeedOut])
async def reorder_prepared_seeds(
    session_id: UUID,
    body: PreparedSeedReorder,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    player_id = await _own_player(session_id, current_user, db)
    try:
        rows = await svc.reorder_seeds(db, player_id, body.ids)
    except svc.PreparedSeedError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return [_out(row) for row in rows]
