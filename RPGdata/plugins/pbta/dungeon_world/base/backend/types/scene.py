from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, field_validator

from ..scene_context import normalize_scene_mode

SceneMode = Literal["travel", "camp", "action"]


class SceneData(BaseModel):
  mode: SceneMode = "action"

  @field_validator("mode", mode="before")
  @classmethod
  def _coerce_mode(cls, value):
    return normalize_scene_mode(value if value is not None else "action")
