from __future__ import annotations


from typing import Any, Dict, Set, List, Optional, Union
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl

from app.scheme.audio import AudioTrackOut, ExposureAudioLinkIn
from app.scheme.obstacle import ObstacleOut
from app.scheme.player import Player
from app.scheme.character import PlayerCharacterOut
from app.scheme.game_item import GameItemOut
from app.scheme.location import LocationBase, MapObjectPolygon
from app.scheme.notes import Counter, Note
from app.scheme.npc import NPCOut
from app.scheme.scenario import Scenario
from app.scheme.scene_exposure import SceneExposureBase, SceneExposureCreate, SceneExposureOut
from app.scheme.story_beat import StoryBeatBase




class InnerSceneExposure(SceneExposureCreate):
    id: UUID
    npc_ids: list[UUID] = Field(default_factory=list)
    item_ids: list[UUID] = Field(default_factory=list)
    template_npc_ids: List[UUID] = Field(default_factory=list)
    template_item_ids: List[UUID] = Field(default_factory=list)
    obstacles: List[ObstacleOut] = Field(default_factory=list)

    audio_links: List[ExposureAudioLinkIn] = Field(default_factory=list)  # ← добавить



class InnerStroyBeat(StoryBeatBase):
    id: UUID
    scene_exposures: List[InnerSceneExposure] = Field(default_factory=list)

    class Config:
        from_attributes = True


class InnerLocation(LocationBase):
    id: UUID
    map_objects: List[MapObjectPolygon] = Field(default_factory=list)
    scene_exposures: List[InnerSceneExposure] = Field(default_factory=list)

    class Config:
        from_attributes = True



class InnerNPC(NPCOut):
    pass


# только предметы, которые без владельца
# предметы с владельцами лежат внутри владельцев
class InnerFreeGameItem(GameItemOut):
    pass


class InnerCharacter(PlayerCharacterOut):
    player: Optional[Player] = None


class InnerNote(Note):
    pass


class InnerCounter(Counter):
    pass


class Factory(BaseModel):
    # TODO?
    characters: List[InnerCharacter] = Field(default_factory=list)
    npcs: List[InnerNPC] = Field(default_factory=list)
    items: List[InnerFreeGameItem] = Field(default_factory=list)


class InnerSecenario(Scenario):
    story_beats: List[InnerStroyBeat] = Field(default_factory=list)
    locations: List[InnerLocation] = Field(default_factory=list)

    characters: List[InnerCharacter] = Field(default_factory=list)
    npcs: List[InnerNPC] = Field(default_factory=list)
    items: List[InnerFreeGameItem] = Field(default_factory=list)

    notes: List[InnerNote] = Field(default_factory=list)
    counters: List[InnerCounter] = Field(default_factory=list)

    audio: list[AudioTrackOut] = Field(default_factory=list) 

    # factory
    factories: List[Factory] = Field(default_factory=list)

    # seen
    seen: Set[UUID] = Field(default_factory=set)
    polygon_shown: Set[UUID] = Field(default_factory=set)


