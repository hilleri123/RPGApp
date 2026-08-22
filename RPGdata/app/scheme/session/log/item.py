from typing import Optional, List, Literal, Dict, Any, Type, get_type_hints, get_origin
from pydantic import BaseModel, ConfigDict, ValidationError
from datetime import date, datetime
from uuid import UUID

from ..base_log import LogMsgBase


class LogItemMove(LogMsgBase):
    log_type: Literal['item_move'] = 'item_move'
    item_id: UUID
    from_character_id: Optional[UUID] = None
    from_npc_id: Optional[UUID] = None
    from_location_id: Optional[UUID] = None
    to_character_id: Optional[UUID] = None
    to_npc_id: Optional[UUID] = None
    to_location_id: Optional[UUID] = None