from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel, Field
from uuid import UUID

from app.scheme.audio import AudioTrackOut
from app.scheme.location import Location, LocationBase, LocationOut  # если у тебя другой импорт — поправь
from app.scheme.session.audio_queue import AudioPlayerState, AudioQueueEntry
from app.scheme.session.observer import Observer
from app.scheme.session.settings import Settings
from app.scheme.session.timeline import SessionTimeline
from app.scheme.story_beat import StoryBeatOut
from app.scheme.session.inner.scenario import Factory, InnerCharacter, InnerNPC, InnerFreeGameItem, InnerLocation
from app.scheme.notes import Note, Counter
from app.scheme.session.scene import Scene, SceneInner  # твой файл из сообщения
from app.scheme.session import GameSession
from app.scheme.session.presentation import PresentedEntityView
from app.scheme.seen import PlayerSeenEntry

class WsBase(BaseModel):
    msg_type: str
    role: Literal["master", "player"]


# --- MASTER ---
class MasterSessionInit(WsBase):
    msg_type: Literal["session_init"] = "session_init"
    role: Literal["master"] = "master"

    # init-only:
    locations: list[LocationOut] = Field(default_factory=list)
    story_beats: list[StoryBeatOut] = Field(default_factory=list)  # или InnerStoryBeat, как у тебя называется
    factories: list[Factory] = Field(default_factory=list)

    polygon_shown: list[UUID] = Field(default_factory=list)

    # always:
    notes: list[Note] = Field(default_factory=list)
    counters: list[Counter] = Field(default_factory=list)
    items: list[InnerFreeGameItem] = Field(default_factory=list)
    characters: list[InnerCharacter] = Field(default_factory=list)
    npcs: list[InnerNPC] = Field(default_factory=list)
    scenes: list[Scene] = Field(default_factory=list)

    dispatches: list = Field(default_factory=list)
    message_replies: list = Field(default_factory=list)

    # meta (по желанию)
    notifications: list = Field(default_factory=list)
    logs: list = Field(default_factory=list)
    actions: Optional[list] = None
    observers: list[Observer] = Field(default_factory=list)
    players: list = Field(default_factory=list)
    settings: Settings

    audio: list[AudioTrackOut] = Field(default_factory=list)  # ← ДОБАВИТЬ все 
    
    session: GameSession

    timeline: Optional[SessionTimeline] = None

    audio_queue: list[AudioQueueEntry] = Field(default_factory=list)
    audio_player: AudioPlayerState = Field(default_factory=AudioPlayerState)
    presented_entity: Optional[PresentedEntityView] = None
    data_revealed_entities: list[PlayerSeenEntry] = Field(default_factory=list)


class MasterSessionUpdate(WsBase):
    msg_type: Literal["session_update"] = "session_update"
    role: Literal["master"] = "master"

    fields: list[str] = Field(default_factory=list)

    locations: Optional[list[LocationOut]] = None
    story_beats: Optional[list[StoryBeatOut]] = None
    notes: Optional[list[Note]] = None
    counters: Optional[list[Counter]] = None
    items: Optional[list[InnerFreeGameItem]] = None
    characters: Optional[list[InnerCharacter]] = None
    npcs: Optional[list[InnerNPC]] = None
    scenes: Optional[list[Scene]] = None
    dispatches: Optional[list] = None
    message_replies: Optional[list] = None
    observers: list[Observer] = None
    notifications: Optional[list] = None
    logs: Optional[list] = None
    actions: Optional[list] = None
    settings: Optional[Settings] = None
    polygon_shown: list[UUID] = Field(default_factory=list)

    timeline: Optional[SessionTimeline] = None

    audio_queue: list[AudioQueueEntry] = Field(default_factory=list)
    audio_player: AudioPlayerState = Field(default_factory=AudioPlayerState)
    presented_entity: Optional[PresentedEntityView] = None
    data_revealed_entities: Optional[list[PlayerSeenEntry]] = None


# --- PLAYER ---
class PlayerSessionInit(WsBase):
    msg_type: Literal["session_init"] = "session_init"
    role: Literal["player"] = "player"

    locations: list[LocationOut] = Field(default_factory=list)
    characters: list[InnerCharacter] = Field(default_factory=list)
    npcs: list[InnerNPC] = Field(default_factory=list)
    items: list[InnerFreeGameItem] = Field(default_factory=list)
    scenes: list[Scene] = Field(default_factory=list)  # ВАЖНО: denorm

    dispatches: list = Field(default_factory=list)
    notes: list[Note] = Field(default_factory=list)
    message_replies: list = Field(default_factory=list)

    # meta
    notifications: list = Field(default_factory=list)
    logs: list = Field(default_factory=list)
    actions: Optional[list] = None
    players: list = Field(default_factory=list)
    session: GameSession
    self_player: Optional[dict] = None
    settings: Optional[Settings] = None
    polygon_shown: list[UUID] = Field(default_factory=list)

    audio_queue: list[AudioQueueEntry] = Field(default_factory=list)
    audio_player: AudioPlayerState = Field(default_factory=AudioPlayerState)
    player_seen: list[PlayerSeenEntry] = Field(default_factory=list)
    presented_entity: Optional[PresentedEntityView] = None


class PlayerSessionUpdate(WsBase):
    msg_type: Literal["session_update"] = "session_update"
    role: Literal["player"] = "player"

    fields: list[str] = Field(default_factory=list)

    locations: Optional[list[LocationOut]] = None
    characters: Optional[list[InnerCharacter]] = None
    npcs: Optional[list[InnerNPC]] = None
    items: Optional[list[InnerFreeGameItem]] = None
    scenes: Optional[list[Scene]] = None  # denorm
    dispatches: Optional[list] = None
    notes: Optional[list[Note]] = None
    message_replies: Optional[list] = None
    notifications: Optional[list] = None
    logs: Optional[list] = None
    actions: Optional[list] = None
    settings: Optional[Settings] = None
    polygon_shown: list[UUID] = Field(default_factory=list)

    audio_queue: list[AudioQueueEntry] = Field(default_factory=list)
    audio_player: AudioPlayerState = Field(default_factory=AudioPlayerState)
    player_seen: Optional[list[PlayerSeenEntry]] = None
    presented_entity: Optional[PresentedEntityView] = None
    self_player: Optional[dict] = None
    players: Optional[list] = None


class ObserverSessionInit(BaseModel):
    msg_type: str = "observer_init"
    session: GameSession
    
    location: list[Location] = Field(default_factory=list)
    polygon_shown: list[UUID] = Field(default_factory=list)
    characters: list[InnerCharacter] = Field(default_factory=list)
    players: list = Field(default_factory=list)

    locations: list[LocationOut] = Field(default_factory=list)
    scenes: list[Scene] = Field(default_factory=list)

    audio_queue: list[AudioQueueEntry] = Field(default_factory=list)
    audio_player: AudioPlayerState = Field(default_factory=AudioPlayerState)
    presented_entity: Optional[PresentedEntityView] = None


class ObserverSessionUpdate(BaseModel):
    msg_type: str = "observer_update"
    fields: list[str] = Field(default_factory=list)

    location: list[Location] = Field(default_factory=list)
    polygon_shown: list[UUID] = Field(default_factory=list)

    locations: list[LocationOut] = Field(default_factory=list)
    scenes: list[Scene] = Field(default_factory=list)

    audio_queue: list[AudioQueueEntry] = Field(default_factory=list)
    audio_player: AudioPlayerState = Field(default_factory=AudioPlayerState)
    presented_entity: Optional[PresentedEntityView] = None