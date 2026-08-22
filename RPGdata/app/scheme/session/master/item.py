from typing import Optional, List, Literal, Dict, Any, Type, get_type_hints, get_origin
from pydantic import BaseModel, ConfigDict, ValidationError
from datetime import date, datetime
from uuid import UUID

from app.logger import logger
from ..base_actions import MasterSessionActionBase



class MasterMoveItem(MasterSessionActionBase):
    msg_type: Literal['move_item'] = 'move_item'
    item_id: UUID
    to_character_id: Optional[UUID] = None
    to_npc_id: Optional[UUID] = None
    to_location_id: Optional[UUID] = None

