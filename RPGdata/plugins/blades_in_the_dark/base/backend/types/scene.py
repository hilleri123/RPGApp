from __future__ import annotations

from typing import Annotated, Any, Dict, List, Literal, Optional, Union
from uuid import UUID
from pydantic import BaseModel, Field, model_validator


SceneMode = Literal["travel", "rest"]


class SceneData(BaseModel):
    mode: SceneMode = "travel"