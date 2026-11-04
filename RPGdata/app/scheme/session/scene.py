from typing import Any, Dict, List, Literal, Optional
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
    obstacle_ids: List[UUID] = []
    obstacles: List[ObstacleOut] = []

    @model_validator(mode="before")
    @classmethod
    def _fill_obstacle_ids(cls, data: Any) -> Any:
        if not isinstance(data, dict) or data.get("obstacle_ids"):
            return data
        ids = []
        for ob in data.get("obstacles") or []:
            if isinstance(ob, dict) and ob.get("id"):
                ids.append(ob["id"])
            elif hasattr(ob, "id"):
                ids.append(ob.id)
        return {**data, "obstacle_ids": ids}


class SceneLocationBucket(BaseModel):
    """Списки объектов одной локации внутри сцены. Корень и подлокации."""
    location_id: UUID
    character_ids: List[UUID] = Field(default_factory=list)
    public: SceneElementsInner = Field(default_factory=SceneElementsInner)
    private: SceneElementsInner = Field(default_factory=SceneElementsInner)


class SceneToken(BaseModel):
    entity_type: Literal["character", "npc", "item", "obstacle"]
    entity_id: UUID
    col: int = 0
    row: int = 0
    span_w: int = 1
    span_h: int = 1
    x: Optional[float] = None
    y: Optional[float] = None


class SceneCanvas(BaseModel):
    """Доска показа: карта одной локации, токены и включённые маски. Локация не меняется."""
    id: UUID
    location_id: UUID
    name: str = ""
    tokens: List[SceneToken] = Field(default_factory=list)
    mask_ids: List[UUID] = Field(default_factory=list)
    grid_on: bool = False


class SceneCanvasOut(SceneCanvas):
    """Холст в ответе клиенту. Карта вложена, потому что игрок может её не «видеть» как локацию."""
    location: Optional[dict[str, Any]] = None


class MapOverlay(BaseModel):
    """Рисунок поверх карты. Живёт отдельно от сцены и включается на холсте как маска."""
    id: UUID
    location_id: UUID
    name: str = ""
    scene: dict[str, Any] = Field(default_factory=dict)


def _empty_elements() -> SceneElementsInner:
    return SceneElementsInner()


def sync_scene_projection(scene: "SceneInner") -> None:
    """Корень сцены зеркалит свои списки. character_ids — объединение всех локаций дерева."""
    if not scene.containers:
        scene.containers = [
            SceneLocationBucket(
                location_id=scene.location_id,
                character_ids=list(scene.character_ids or []),
                public=scene.public,
                private=scene.private,
            )
        ]
    root = next((bucket for bucket in scene.containers if bucket.location_id == scene.location_id), None)
    if root is None:
        root = SceneLocationBucket(
            location_id=scene.location_id,
            character_ids=[],
            public=scene.public,
            private=scene.private,
        )
        scene.containers.insert(0, root)
    else:
        root.public = scene.public
        root.private = scene.private
        known = {cid for bucket in scene.containers for cid in bucket.character_ids}
        for cid in scene.character_ids or []:
            if cid not in known:
                root.character_ids.append(cid)
                known.add(cid)
    union: list[UUID] = []
    seen: set[UUID] = set()
    for bucket in scene.containers:
        for cid in bucket.character_ids:
            if cid not in seen:
                seen.add(cid)
                union.append(cid)
    scene.character_ids = union


def switch_scene_root(scene: "SceneInner", location_id: UUID, private: Optional[SceneElementsInner] = None) -> None:
    """Смена корня не стирает списки прежней локации. Новая локация получает свой контейнер."""
    sync_scene_projection(scene)
    scene.location_id = location_id
    bucket = next((item for item in scene.containers if item.location_id == location_id), None)
    if bucket is None:
        bucket = SceneLocationBucket(
            location_id=location_id,
            public=_empty_elements(),
            private=private or _empty_elements(),
        )
        scene.containers.append(bucket)
    scene.public = bucket.public
    scene.private = bucket.private
    sync_scene_projection(scene)


class Scene(BaseModel):
    id: UUID
    name: str
    data: dict[str, Any] = Field(default_factory=dict)
    location: Optional[Location] = None
    characters: List[PlayerCharacter]
    public: SceneElements
    private: SceneElements
    containers: List[SceneLocationBucket] = Field(default_factory=list)
    canvases: List[SceneCanvasOut] = Field(default_factory=list)
    shown_canvas_id: Optional[UUID] = None
    player_canvas: Dict[str, UUID] = Field(default_factory=dict)

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
    containers: List[SceneLocationBucket] = Field(default_factory=list)
    canvases: List[SceneCanvas] = Field(default_factory=list)
    shown_canvas_id: Optional[UUID] = None
    player_canvas: Dict[str, UUID] = Field(default_factory=dict)

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
        if not data.get("containers") and data.get("location_id"):
            data = {
                **data,
                "containers": [{
                    "location_id": data.get("location_id"),
                    "character_ids": data.get("character_ids") or [],
                    "public": data.get("public") or {},
                    "private": data.get("private") or {},
                }],
            }
        return data

