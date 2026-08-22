from __future__ import annotations

from typing import Any, Dict, Optional
from uuid import UUID

from pydantic import BaseModel

from app.scheme.common import UpsertPayload, UpsertResult, ORMWithTagsModel


class ObstacleBase(BaseModel):
    name: str
    tags: Optional[list[str]] = None
    description_for_master: Optional[str] = None
    description_for_players: Optional[str] = None

    data: Dict[str, Any] = {}


class ObstacleCreate(ObstacleBase):
    pass


class ObstacleUpdate(ObstacleBase):
    pass


# RES GET_BY_ID
# RES GET ALL
class ObstacleOut(ObstacleBase, ORMWithTagsModel):
    id: UUID

    data: Dict[str, Any] = {}

    class Config:
        from_attributes = True




