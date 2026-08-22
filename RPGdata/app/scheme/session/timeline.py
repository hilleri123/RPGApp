from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID, uuid4
from pydantic import BaseModel, Field


class TimelineEvent(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    kind: str
    title: str
    occurred_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    scene_id: Optional[UUID] = None
    story_beat_id: Optional[UUID] = None
    payload: dict[str, Any] = Field(default_factory=dict)


class SceneTimeState(BaseModel):
    scene_id: UUID
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    is_active: bool = False


class SessionTimelineInner(BaseModel):
    scenario_started_at: Optional[datetime] = None
    current_time: Optional[datetime] = None
    # scene_times: list[SceneTimeState] = Field(default_factory=list)
    events: list[TimelineEvent] = Field(default_factory=list)


class SessionTimeline(BaseModel):
    scenario_started_at: Optional[datetime] = None
    current_time: Optional[datetime] = None
    scene_times: list[SceneTimeState] = Field(default_factory=list)
    events: list[TimelineEvent] = Field(default_factory=list)