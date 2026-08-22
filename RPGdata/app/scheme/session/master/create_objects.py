from typing import Optional, List, Literal, Dict, Any, Type, get_type_hints, get_origin
from pydantic import BaseModel, ConfigDict, ValidationError
from datetime import date, datetime
from uuid import UUID

from app.logger import logger
from ...location import LocationOut
from ..base_actions import MasterSessionActionBase


class CreateLocation(MasterSessionActionBase):
    msg_type: Literal["create_location"] = "create_location"
    location: Any


class UpdateLocation(MasterSessionActionBase):
    msg_type: Literal["update_location"] = "update_location"
    location: Any


class MasterCreateItem(MasterSessionActionBase):
    msg_type: Literal['create_item'] = 'create_item'
    scene_id: UUID
    item: Any

class MasterCreateNPC(MasterSessionActionBase):
    msg_type: Literal['create_npc'] = 'create_npc'
    scene_id: UUID
    npc: Any

class MasterCreateObstacle(MasterSessionActionBase):
    msg_type: Literal['create_obstacle'] = 'create_obstacle'
    scene_id: UUID
    obstacle: Any

class MasterUpdateItem(MasterSessionActionBase):
    msg_type: Literal['update_item'] = 'update_item'
    scene_id: UUID
    item: Any

class MasterUpdateNPC(MasterSessionActionBase):
    msg_type: Literal['update_npc'] = 'update_npc'
    scene_id: UUID
    npc: Any

class MasterUpdateObstacle(MasterSessionActionBase):
    msg_type: Literal['update_obstacle'] = 'update_obstacle'
    scene_id: UUID
    obstacle: Any

class MasterDeleteItem(MasterSessionActionBase):
    msg_type: Literal['delete_item'] = 'delete_item'
    item_id: UUID

class MasterDeleteNPC(MasterSessionActionBase):
    msg_type: Literal['delete_npc'] = 'delete_npc'
    npc_id: UUID



class MasterUpdateCharacter(MasterSessionActionBase):
    msg_type: Literal['update_character'] = 'update_character'
    character: Any
