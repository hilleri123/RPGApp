from typing import Optional, List, Literal, Dict, Any, Type, get_type_hints, get_origin
from pydantic import BaseModel, ConfigDict, ValidationError
from datetime import date, datetime
from uuid import UUID

from app.logger import logger
from ..base_actions import PlayerSessionActionBase



class PlayerMoveItem(PlayerSessionActionBase):
    msg_type: Literal['move_item'] = 'move_item'
    item_id: UUID
    to_character_id: Optional[UUID] = None
    to_npc_id: Optional[UUID] = None
    to_location_id: Optional[UUID] = None


class PlayerDropItem(PlayerSessionActionBase):
    msg_type: Literal['drop_item'] = 'drop_item'
    item_id: UUID


class PlayerTakeItem(PlayerSessionActionBase):
    msg_type: Literal['take_item'] = 'take_item'
    item_id: UUID


class PlayerUseItem(PlayerSessionActionBase):
    msg_type: Literal['use_item'] = 'use_item'
    item_id: UUID
    body_id: UUID
    use_id: Optional[UUID] = None


