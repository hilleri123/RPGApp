from __future__ import annotations


from typing import Any, Dict, List, Optional, Union
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl, field_validator

from app.scheme.scene_exposure import (
    SceneExposureCreate,
    SceneExposureOut,
    SceneExposurePreview,
    build_scene_exposure_preview,
)

from .common import UpsertPayload, UpsertResult, ORMWithTagsModel



# --- story beat main ---

class StoryBeatBase(BaseModel):
    name: str
    tags: Optional[list[str]] = None
    order_num: int = 0

    text_for_master: Optional[str] = None
    text_for_players: Optional[str] = None

    img_url: Optional[HttpUrl] = None
    parent_story_beat_id: Optional[UUID] = None

    # как было раньше
    location_ids: List[UUID] = []
    npc_ids: List[UUID] = []


class StoryBeatOut(StoryBeatBase, ORMWithTagsModel):
    id: UUID
    source_entity_id: Optional[UUID] = None

    scene_exposures: List[SceneExposureOut] = []

    class Config:
        from_attributes = True


class StoryBeatListOut(StoryBeatBase, ORMWithTagsModel):
    id: UUID
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

    class Config:
        from_attributes = True


class StoryBeatUpsertPayload(StoryBeatBase, UpsertPayload):
    scene_exposures: List[SceneExposureCreate] = []


class StoryBeatUpsertResult(UpsertResult):
    story_beat: Optional[StoryBeatOut] = None
