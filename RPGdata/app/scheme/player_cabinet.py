from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class PlayedEveningOut(BaseModel):
    session_id: UUID
    name: str
    created_at: Optional[datetime] = None
    is_active: bool = False
    character_name: Optional[str] = None


class PlayedGameOut(BaseModel):
    id: str
    name: str
    master_name: Optional[str] = None
    character_name: Optional[str] = None
    color: Optional[str] = None
    active_session_id: Optional[UUID] = None
    played_at: Optional[datetime] = None
    evenings: list[PlayedEveningOut] = Field(default_factory=list)


class PlayedGamesOut(BaseModel):
    items: list[PlayedGameOut] = Field(default_factory=list)


class MyCharacterGameOut(BaseModel):
    scenario_id: UUID
    name: str


class MyCharacterOut(BaseModel):
    id: UUID
    name: str
    short_desc: Optional[str] = None
    img_url: Optional[str] = None
    icon_url: Optional[str] = None
    games: list[MyCharacterGameOut] = Field(default_factory=list)


class MyCharactersOut(BaseModel):
    items: list[MyCharacterOut] = Field(default_factory=list)
