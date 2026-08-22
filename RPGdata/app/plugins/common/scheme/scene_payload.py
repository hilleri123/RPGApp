from __future__ import annotations

from typing import Any, Optional
from pydantic import BaseModel, Field

class SceneCharacter(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)
    items: list[dict[str, Any]] = Field(default_factory=list)

class ScenePlayerEntry(BaseModel):
    characters: list[SceneCharacter] = Field(default_factory=list)

class SceneNpcEntry(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)
    items: list[dict[str, Any]] = Field(default_factory=list)

class ScenePayload(BaseModel):
    players: dict[str, ScenePlayerEntry] = Field(default_factory=dict)  # key = user_id (str)
    npc: list[SceneNpcEntry] = Field(default_factory=list)
    items: list[dict[str, Any]] = Field(default_factory=list)          # “сценовые” items
