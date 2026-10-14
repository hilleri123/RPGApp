"""Подсказка объектов сценария и сборка их по id для вставки в строку."""

from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.auth import require_master
from app.infrastructure.database import get_async_session as get_db
from app.routes._helpers import get_scenario_or_404, get_scenario_read
from app.services import scenario_search as search

router = APIRouter(prefix="/scenarios/{scenario_id}/mentions", tags=["mentions"])

# kind в ссылке [//kind:id] → тип поиска
_KIND_TO_TYPE = {
    "npc": "npc",
    "item": "game_item",
    "character": "player_character",
    "location": "location",
    "note": "note",
}
_TYPE_TO_KIND = {value: key for key, value in _KIND_TO_TYPE.items()}
_KIND_MODEL = {
    "npc": models.NPC,
    "item": models.GameItem,
    "character": models.PlayerCharacter,
    "location": models.Location,
    "note": models.Note,
}


class MentionHit(BaseModel):
    kind: str
    id: UUID
    name: str


class MentionRef(BaseModel):
    kind: str
    id: UUID


class MentionResolveIn(BaseModel):
    refs: list[MentionRef] = Field(default_factory=list)


def _hit(kind: str, row_id: UUID, name: str) -> MentionHit:
    return MentionHit(kind=kind, id=row_id, name=name)


@router.get("", response_model=list[MentionHit])
async def suggest_mentions(
    q: Optional[str] = None,
    types: Optional[str] = Query(None, description="kind через запятую: npc,item,character,location,note"),
    limit: int = 12,
    scenario: models.Scenario = Depends(get_scenario_or_404),
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db),
):
    kinds = [part.strip().lower() for part in (types or "").split(",") if part.strip()]
    search_types = [_KIND_TO_TYPE[kind] for kind in kinds if kind in _KIND_TO_TYPE] or None
    hits = await search.search_scenario(
        db,
        scenario.id,
        q=q,
        types=search_types,
        limit=limit,
    )
    out: list[MentionHit] = []
    for hit in hits:
        kind = _TYPE_TO_KIND.get(hit.type)
        if not kind:
            continue
        if kinds and kind not in kinds:
            continue
        out.append(_hit(kind, hit.id, hit.name))
    return out


@router.post("/resolve", response_model=list[MentionHit])
async def resolve_mentions(
    body: MentionResolveIn,
    scenario: models.Scenario = Depends(get_scenario_read),
    db: AsyncSession = Depends(get_db),
):
    if not body.refs:
        return []
    found: dict[tuple[str, str], MentionHit] = {}
    by_kind: dict[str, set[UUID]] = {}
    for ref in body.refs:
        if ref.kind not in _KIND_MODEL:
            continue
        by_kind.setdefault(ref.kind, set()).add(ref.id)
    for kind, ids in by_kind.items():
        model = _KIND_MODEL[kind]
        rows = (
            await db.execute(
                select(model).where(
                    model.scenario_id == scenario.id,
                    model.id.in_(ids),
                )
            )
        ).scalars().all()
        for row in rows:
            found[(kind, str(row.id))] = _hit(kind, row.id, getattr(row, "name", "") or "")
    return [hit for ref in body.refs if (hit := found.get((ref.kind, str(ref.id))))]
