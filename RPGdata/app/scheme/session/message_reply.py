from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal, Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class SessionMessageReply(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    note_id: UUID
    author_id: UUID
    author_role: Literal["master", "player"]
    author_name: Optional[str] = None
    text: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    edited_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
