from typing import Optional, List, Literal, Dict, Any, Type, get_type_hints, get_origin
from pydantic import BaseModel, ConfigDict, ValidationError
from datetime import date, datetime
from uuid import UUID

from app.logger import logger
from ..base_actions import MasterSessionActionBase


class CreateFactoryObject(MasterSessionActionBase):
    msg_type: Literal['create_factory_object'] = 'create_factory_object'
    scene_id: Optional[UUID] = None
    kind: str
    object_id: UUID
    