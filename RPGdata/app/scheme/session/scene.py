from typing import Any, Dict, List, Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator
from uuid import UUID

from ..auth import User
from ..player import PlayerWithCharacter
from ..scenario import FullScenario, Scenario
from ..character import PlayerCharacter
from ..npc import NPC
from ..game_item import GameItem
from ..lobby import Lobby
from ..location import Location
from ..obstacle import ObstacleOut




class SceneElements(BaseModel):
    npcs: List[NPC] = []
    items: List[GameItem] = []
    obstacles: List[ObstacleOut] = []

class SceneElementsInner(BaseModel):
    npc_ids: List[UUID] = []
    item_ids: List[UUID] = []
    obstacles: List[ObstacleOut] = []

class Scene(BaseModel):
    id: UUID
    name: str
    data: dict[str, Any] = Field(default_factory=dict)
    location: Optional[Location] = None
    characters: List[PlayerCharacter]
    public: SceneElements
    private: SceneElements

    parent_scene_id: Optional[UUID] = None   # ← новое поле

    datetime: Optional[str] = None

    available_actions: List[Dict[str, Any]] = Field(default_factory=list)



class SceneInner(BaseModel):
    id: UUID
    name: str
    data: dict[str, Any] = Field(default_factory=dict)
    location_id: UUID
    character_ids: List[UUID]
    public: SceneElementsInner
    private: SceneElementsInner

    parent_scene_id: Optional[UUID] = None   # ← новое поле

    datetime: Optional[str] = None

    available_actions_by_role: Dict[str, List[Dict[str, Any]]] = Field(default_factory=dict)

