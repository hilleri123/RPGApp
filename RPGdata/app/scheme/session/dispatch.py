from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Literal, Optional, Dict
from uuid import UUID, uuid4

from pydantic import BaseModel, Field

from app.scheme.notes import Note, NoteCreate


class SessionDispatch(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    sent_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    sender_id: UUID
    sender_role: Literal["master", "player"]
    sender_name: Optional[str] = None
    note: Note
    recipient_user_ids: List[UUID] = Field(default_factory=list)
    recipient_character_ids: List[UUID] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    read_by: List[UUID] = Field(default_factory=list)
    read_at_by: Dict[str, datetime] = Field(default_factory=dict)
    revoked_at: Optional[datetime] = None
    edited_at: Optional[datetime] = None
    edited_by: Optional[UUID] = None


class DispatchNoteAction(BaseModel):
    """Shared payload for master/player dispatch WS actions."""
    note_id: Optional[UUID] = None
    note: Optional[NoteCreate] = None
    character_ids: List[UUID] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
