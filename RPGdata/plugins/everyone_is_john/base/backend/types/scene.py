from __future__ import annotations

from typing import Annotated, Any, Dict, List, Literal, Optional, Union
from uuid import UUID
from pydantic import BaseModel, Field, model_validator




class SceneData(BaseModel):
    character_id: Optional[UUID] = None
    buff: int = 0
