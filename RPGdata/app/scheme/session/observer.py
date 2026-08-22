
from typing import List, Optional, Union
from datetime import datetime, timezone
from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID


class Observer(BaseModel):
    code: str
    scene_id: Optional[UUID] = None
    location_id: Optional[UUID] = None


class ObserverRoomPreview(BaseModel):
    """Public catalog entry: one row per observer code on an active session."""

    code: str
    session_id: UUID
    session_name: str
    scenario_name: str = ""
    master_name: str = ""
    player_count: int = 0
    rule_id_str: str = ""
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
