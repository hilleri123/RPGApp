from typing import Any, Dict, Optional, List
from pydantic import BaseModel, Field, HttpUrl, model_validator
from uuid import UUID

from app.scheme.common import UpsertPayload, UpsertResult, ORMWithTagsModel

from pydantic import field_validator

from .scene_exposure import SceneExposureOut, SceneExposureCreate, SceneExposurePreview, build_scene_exposure_preview


class MapObjectPolygonPoint(BaseModel):
    x: float
    y: float


class MapObjectPolygonBase(BaseModel):
    name: str
    source_location_id: UUID
    target_location_id: Optional[UUID] = None

    internal_id: Optional[str] = None

    is_shown: Optional[bool] = True
    is_filled: Optional[bool] = False
    is_line: Optional[bool] = False
    alpha: float = 0.5
    color: str
    polygon_list: List[MapObjectPolygonPoint]
    icon: Optional[str] = None
    icon_url: Optional[HttpUrl] = None

    class Config:
        from_attributes = True


class MapObjectPolygonCreate(MapObjectPolygonBase):
    pass


class MapObjectPolygon(MapObjectPolygonBase):
    id: UUID

    class Config:
        from_attributes = True


class MapObjectPolygonUpdate(MapObjectPolygon):
    pass




class LocationImage(BaseModel):
    url: str
    path: Optional[str] = None    # путь на диске (для внутреннего использования)
    caption: Optional[str] = None


class LocationBase(BaseModel):
    id: Optional[UUID] = None
    name: str
    tags: Optional[list[str]] = None
    description_for_master: str
    description_for_players: str
    parent_location_id: Optional[UUID] = None
    is_start: Optional[bool] = False

    icon_url: Optional[HttpUrl] = None
    map_url: Optional[HttpUrl] = None
    map_width: Optional[int] = None
    map_height: Optional[int] = None
    excalidraw_map_json: Optional[dict[str, Any]] = None




# RES GET_BY_ID
class LocationOut(LocationBase, ORMWithTagsModel):
    id: UUID
    source_entity_id: Optional[UUID] = None
    parent_location_name: Optional[str] = None
    map_type: Optional[str] = None          # вычисляется из модели через @property
    image_map_path: Optional[str] = None    # путь к растровой карте на диске
    map_objects: List[MapObjectPolygon] = Field(default_factory=list)
    scene_exposures: List[SceneExposureOut] = Field(default_factory=list)

    extra_images: Optional[List[LocationImage]] = Field(default_factory=list)

    class Config:
        from_attributes = True


class Location(LocationOut):
    data: Dict[str, Any] = Field(default_factory=dict)


# RES GET ALL
class LocationList(LocationBase, ORMWithTagsModel):
    id: UUID
    parent_location_name: Optional[str] = None
    scene_exposures: List[SceneExposurePreview] = Field(default_factory=list)

    @field_validator("scene_exposures", mode="before")
    @classmethod
    def _scene_exposures_preview(cls, v):
        if v is None:
            return []
        if isinstance(v, list) and (not v or isinstance(v[0], SceneExposurePreview)):
            return v
        if isinstance(v, list):
            return [
                build_scene_exposure_preview(se)
                for se in sorted(v, key=lambda x: getattr(x, "order_num", 0) or 0)
            ]
        return []

    @model_validator(mode='before')
    @classmethod
    def _extract_parent_name(cls, v):
        if hasattr(v, 'parent_location') and v.parent_location:
            # Pydantic v2: просто возвращаем объект, поле будет вычислено ниже
            pass
        return v

    @model_validator(mode='after')
    def _fill_parent_name(self):
        # Заполняется через ORM-объект в LocationOut — здесь через model_validate
        return self
    
    class Config:
        from_attributes = True

class SubLocationRef(BaseModel):
    id: Optional[UUID] = None
    name: str
# IN POST/PUT
class LocationUpsertPayload(LocationBase, UpsertPayload):
    map_objects: List[MapObjectPolygonCreate] = Field(default_factory=list)
    sublocations: list[SubLocationRef] = Field(default_factory=list)
    scene_exposures: List[SceneExposureCreate] = Field(default_factory=list)


class LocationUpsertResult(UpsertResult):
    location: Optional[LocationOut] = None



class SubLocationFromMapItem(BaseModel):
    """Один элемент из JSON карты, выбранный чекбоксом."""
    name: str
    polygon: List[MapObjectPolygonPoint]
    map_key: Optional[str] = None           # id/ключ объекта из JSON карты
    color: Optional[str] = "#00ff00"
    description_for_master: Optional[str] = ""
    description_for_players: Optional[str] = ""


class SubLocationsFromMapPayload(BaseModel):
    items: List[SubLocationFromMapItem]


class SubLocationsFromMapResult(BaseModel):
    created: List[LocationOut]