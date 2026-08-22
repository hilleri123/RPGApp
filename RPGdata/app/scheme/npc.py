from __future__ import annotations

from typing import Any, Dict, Optional

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, model_validator

from .common import UpsertPayload, UpsertResult, ORMWithTagsModel
from .game_item import GameItemOut, ItemContainedLinkIn, GameItemOut



# --------- ORM Out (простая) ---------

class NPCBase(BaseModel):
    name: str
    tags: Optional[list[str]] = None
    description_for_master: Optional[str] = None
    description_for_players: Optional[str] = None
    icon_url: Optional[HttpUrl] = None
    img_url: Optional[HttpUrl] = None


# RES GET_BY_ID
class NPCOut(NPCBase, ORMWithTagsModel):
    id: UUID
    source_entity_id: Optional[UUID] = None
    copied_from: Optional[UUID] = None
    data: Dict[str, Any] = {}
    owned_items: list[GameItemOut] = []

    class Config:
        from_attributes = True


class NPC(NPCOut):
    data: Dict[str, Any] = {}


# RES GET ALL
class NPCList(NPCBase, ORMWithTagsModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID

    exposure_names: Optional[list[str]] = Field(default_factory=list)

    @model_validator(mode='before')
    @classmethod
    def _fill_exposure_names(cls, obj):
        # obj здесь — сырой ORM-объект до превращения в dict
        try:
            if hasattr(obj, 'scene_exposures'):
                exposures = obj.scene_exposures or []
                # записываем напрямую в obj как атрибут не получится,
                # поэтому возвращаем dict
                data = {
                    c.key: getattr(obj, c.key)
                    for c in obj.__table__.columns
                }
                data['exposure_names'] = [se.name for se in exposures]
                return data
        except Exception:
            pass
        return obj


# IN POST/PUT
class NPCUpsertPayload(NPCBase, UpsertPayload):
    owned_items: list[ItemContainedLinkIn] = []


# RES POST/PUT
class NPCUpsertResult(UpsertResult):
    npc: Optional[NPCOut] = None
