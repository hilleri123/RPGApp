# app/scheme/note.py
from pydantic import BaseModel, Field, HttpUrl
from uuid import UUID
from typing import Optional, List, Literal
from datetime import datetime

class NoteBase(BaseModel):
    name: str
    text: Optional[str] = None
    allowed_character_shown_json: Optional[list[UUID]] = None
    icon_url: Optional[HttpUrl] = None
    img_url: Optional[HttpUrl] = None
    tags: Optional[list[str]] = None
    is_checked: bool = False
    owner_user_id: Optional[UUID] = None
    owner_role: Optional[Literal["master", "player"]] = None
    parent_note_id: Optional[UUID] = None
    sort_order: int = 0

    class Config:
        from_attributes = True

class NoteCreate(NoteBase):
    pass


class Note(NoteBase):
    id: UUID
    character_shown: Optional[list[UUID]] = None
    source_entity_id: Optional[UUID] = None


class CounterBase(BaseModel):
    name: str
    description: Optional[str] = None
    value: int = 0
    min_value: Optional[int] = None
    max_value: Optional[int] = None
    character_id: Optional[UUID] = None  # None = глобальный
    tags: Optional[list[str]] = None

    class Config:
        from_attributes = True

class CounterCreate(CounterBase):
    pass

class Counter(CounterBase):
    id: UUID
    scenario_id: UUID
    source_entity_id: Optional[UUID] = None


class CounterAdjust(BaseModel):
    delta: int
    comment: Optional[str] = None


class CounterChange(BaseModel):
    id: UUID
    counter_id: UUID
    delta: int
    old_value: int
    new_value: int
    comment: Optional[str] = None
    user_id: Optional[UUID] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
