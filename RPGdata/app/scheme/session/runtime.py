"""Redis payload for session runtime state (no scenario entities)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, List, Optional, Set
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field

from app.scheme.auth import User
from app.scheme.player import PlayerWithCharacter
from app.scheme.session.audio_queue import AudioPlayerState, AudioQueueEntry
from app.scheme.session.base_log import LogMsgBase
from app.scheme.session.base_notifications import NotificationBase
from app.scheme.session.observer import Observer
from app.scheme.session.plugin_actions import ActionRecord
from app.scheme.session.scene import SceneInner
from app.scheme.session.session import SessionErrorEntry
from app.scheme.session.settings import Settings
from app.scheme.session.presentation import PresentedEntityView
from app.scheme.session.timeline import SessionTimelineInner


def _all_subclasses(cls):
    return set(cls.__subclasses__()).union(
        s for c in cls.__subclasses__() for s in _all_subclasses(c)
    )


_log_types = tuple(_all_subclasses(LogMsgBase))
_notification_types = tuple(_all_subclasses(NotificationBase))


class SessionRuntimeState(BaseModel):
    id: UUID
    scenario_id: UUID
    rule_id_str: str
    name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    master: User
    players: List[PlayerWithCharacter] = Field(default_factory=list)

    data: dict[str, Any] = Field(default_factory=dict)
    logs: List[Any] = Field(default_factory=list)
    notifications: List[Any] = Field(default_factory=list)
    scenes: list[SceneInner] = Field(default_factory=list)
    actions: list[ActionRecord] = Field(default_factory=list)
    observers: list[Observer] = Field(default_factory=list)
    settings: Settings = Field(default_factory=Settings)

    audio_queue: list[AudioQueueEntry] = Field(default_factory=list)
    audio_player: AudioPlayerState = Field(default_factory=AudioPlayerState)

    timeline: SessionTimelineInner = Field(default_factory=SessionTimelineInner)
    errors: list[SessionErrorEntry] = Field(default_factory=list)

    seen: Set[UUID] = Field(default_factory=set)
    polygon_shown: Set[UUID] = Field(default_factory=set)

    dispatches: List[Any] = Field(default_factory=list)
    message_replies: List[Any] = Field(default_factory=list)

    campaign_id: Optional[UUID] = None
    campaign_step_index: Optional[int] = None
    campaign_name: Optional[str] = None
    campaign_total_steps: Optional[int] = None

    launched_scenario_id: Optional[UUID] = None
    approach_session_id: Optional[UUID] = None
    party_id: Optional[UUID] = None

    presented_entity: Optional[PresentedEntityView] = None

    model_config = ConfigDict(
        ser_json_encoders={datetime: lambda v: v.isoformat()},
        from_attributes=True,
    )
