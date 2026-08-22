# plugins/gumshoe/npc_dialog/types.py
from __future__ import annotations
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field


class DialogSpendRecord(BaseModel):
    character_id: str
    skill_name: str
    cost: int = 1
    note: str = ""          # заметка за что потрачено
    confirmed: bool = False


class DialogEntry(BaseModel):
    character_ids: list[str] = Field(default_factory=list)
    npc_ids: list[str] = Field(default_factory=list)
    spend_records: list[DialogSpendRecord] = Field(default_factory=list)
    finished: bool = False


class DialogContext(BaseModel):
    sceneId: UUID
    entry: Optional[DialogEntry] = None
    skillsConfig: Optional[dict] = None   # пробрасываем конфиг навыков