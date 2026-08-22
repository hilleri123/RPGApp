from typing import List, Optional, Union, Any
from datetime import datetime, timezone
from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID

from app.scheme.audio import ExposureAudioLinkIn
from app.scheme.obstacle import ObstacleOut
from app.scheme.scenario_todo import ScenarioTodoOut
from app.scheme.session.audio_queue import AudioPlayerState, AudioQueueEntry
from app.scheme.session.inner.scenario import InnerSecenario


from ..auth import User
from ..player import PlayerWithCharacter
from ..scenario import FullScenario, Scenario

from .observer import Observer
from .timeline import SessionTimelineInner
from .presentation import PresentedEntityView
from .base_log import LogMsgBase
from .base_notifications import NotificationBase
from .scene import Scene, SceneInner
from .settings import Settings
from .plugin_actions import ActionRecord

from .log import *

def all_subclasses(cls):
    return set(cls.__subclasses__()).union(
        s for c in cls.__subclasses__() for s in all_subclasses(c)
    )

log_msg_types = tuple(all_subclasses(LogMsgBase))  # кортеж типов
LogUnion = Union[log_msg_types]

notification_types = tuple(all_subclasses(NotificationBase))  # кортеж типов
NotificationUnion = Union[notification_types]





class SessionErrorEntry(BaseModel):
    id:          str      = Field(default_factory=lambda: str(uuid4()))
    context:     str                        # "create_location:db", "update_location:db", ...
    error:       str                        # тип исключения: "HTTPException", "ValueError", ...
    message:     str                        # str(exc)
    traceback:   str                        # полный traceback.format_exc()
    occurred_at: str = Field(             # ISO-строка
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class GameSessionBase(BaseModel):
    scenario_id: UUID
    rule_id_str: str
    name: str
    created_at: Optional[datetime] = datetime.now(timezone.utc)
    master: User
    players: List[PlayerWithCharacter]

    campaign_id: Optional[UUID] = None
    campaign_step_index: Optional[int] = None
    campaign_name: Optional[str] = None
    campaign_total_steps: Optional[int] = None

    launched_scenario_id: Optional[UUID] = None
    party_id: Optional[UUID] = None
    approach_kind: Optional[str] = None  # approach | legacy

    model_config = ConfigDict(
        ser_json_encoders={
            datetime: lambda v: v.isoformat()
        },
        from_attributes=True
    )





class GameSession(GameSessionBase):
    id: UUID
    scenes: List[Scene] = []

    model_config = ConfigDict(
        from_attributes=True
    )




class GameSessionInner(GameSessionBase, InnerSecenario):
    id: UUID
    data: dict[str, Any] = Field(default_factory=dict)
    logs: List[LogUnion] = []
    notifications: List[NotificationUnion] = []
    scenes: list[SceneInner] = Field(default_factory=list)
    actions: list[ActionRecord] = Field(default_factory=list)
    observers: list[Observer] = Field(default_factory=list)
    settings: Settings = Field(default_factory=Settings)  

    obstacles: list[ObstacleOut] = Field(default_factory=list)

    audio_queue: list[AudioQueueEntry] = Field(default_factory=list)
    audio_player: AudioPlayerState = Field(default_factory=AudioPlayerState)  

    todos: list[ScenarioTodoOut] = Field(default_factory=list)

    timeline: SessionTimelineInner = Field(default_factory=SessionTimelineInner)

    presented_entity: Optional[PresentedEntityView] = None

    dispatches: List[Any] = Field(default_factory=list)
    message_replies: List[Any] = Field(default_factory=list)

    errors: list[SessionErrorEntry] = Field(default_factory=list)

    model_config = ConfigDict(
        from_attributes=True
    )

class GameSessionPreview(GameSessionBase):
    id: UUID
    scenario: Scenario

    model_config = ConfigDict(
        from_attributes=True
    )

