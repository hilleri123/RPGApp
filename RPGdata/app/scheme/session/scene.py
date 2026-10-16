from typing import Any, Dict, List, Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
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

    parent_scene_id: Optional[UUID] = None
    # Раскрыта: у сцены заведены подсцены и полоса «↳ подсцены» для неё открыта.
    expanded: bool = False
    # Верхний ряд. Подсцена без этого флага видна только в нижнем ряду родителя.
    in_top_row: bool = False
    # Подсцена показывает карту локации родительской сцены. Видят и мастер, и игроки.
    show_parent_scene_map: bool = False
    # Старые сессии: копия, которую больше не создаём. Поле оставлено, чтобы Redis читался.
    sublocation_of_scene_id: Optional[UUID] = None
    # Локация родительской сцены, если включён показ её карты. В Redis не хранится.
    parent_scene_location: Optional[Location] = None

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

    parent_scene_id: Optional[UUID] = None
    expanded: bool = False
    in_top_row: bool = False
    show_parent_scene_map: bool = False
    sublocation_of_scene_id: Optional[UUID] = None

    datetime: Optional[str] = None

    available_actions_by_role: Dict[str, List[Dict[str, Any]]] = Field(default_factory=dict)

    @model_validator(mode="before")
    @classmethod
    def _default_row_flags(cls, data: Any) -> Any:
        """Старые сцены в Redis без новых полей: корень в верхнем ряду, подсцена — нет."""
        if not isinstance(data, dict):
            return data
        if "in_top_row" not in data:
            data = {**data, "in_top_row": data.get("parent_scene_id") is None}
        if "expanded" not in data:
            data = {**data, "expanded": False}
        return data

