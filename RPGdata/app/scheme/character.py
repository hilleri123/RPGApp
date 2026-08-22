from __future__ import annotations

from typing import Any, Dict, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, HttpUrl, Field

from .common import ORMWithTagsModel, UpsertPayload, UpsertResult
from .game_item import GameItemOut, ItemContainedLinkIn, GameItemOut



# --------- ORM Out (простая) ---------
class CharacterProfileFields(BaseModel):
    name: str
    short_desc: Optional[str] = None
    story: Optional[str] = None
    icon_url: Optional[HttpUrl] = None
    img_url: Optional[HttpUrl] = None
    tags: Optional[list[str]] = None

class CharacterDataBase(CharacterProfileFields):
    """+ data для plugin-полей"""
    data: Dict[str, Any] = Field(default_factory=dict)

# PlayerCharacterBase теперь просто наследует:
class PlayerCharacterBase(CharacterProfileFields):
    location_id: Optional[UUID] = None
    application_id: Optional[UUID] = None
    bound_user_id: Optional[UUID] = None


# RES GET_BY_ID
class PlayerCharacterOut(PlayerCharacterBase, ORMWithTagsModel):
    id: UUID
    source_entity_id: Optional[UUID] = None
    copied_from: Optional[UUID] = None
    bound_user_id: Optional[UUID] = None
    data: Dict[str, Any] = Field(default_factory=dict)
    owned_items: list[GameItemOut] = Field(default_factory=list)

    class Config:
        from_attributes = True

class PlayerCharacter(PlayerCharacterOut):
    data: Dict[str, Any] = Field(default_factory=dict)


# RES GET ALL
class PlayerCharacterList(PlayerCharacterBase, ORMWithTagsModel):
    id: UUID

    class Config:
        from_attributes = True



# IN POST/PUT
class CharacterUpsertPayload(PlayerCharacterBase, UpsertPayload):
    owned_items: list[ItemContainedLinkIn] = Field(default_factory=list)


# RES POST/PUT
class CharacterUpsertResult(UpsertResult):
    character: Optional[PlayerCharacterOut] = None



