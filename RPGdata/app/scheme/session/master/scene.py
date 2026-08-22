from typing import Optional, List, Literal, Dict, Any, Type, get_type_hints, get_origin
from pydantic import BaseModel, ConfigDict, ValidationError
from datetime import date, datetime
from uuid import UUID

from app.logger import logger
from ..base_actions import MasterSessionActionBase



class MakeNPCDead(MasterSessionActionBase):
    msg_type: Literal['make_npc_dead'] = 'make_npc_dead'
    npc_id: UUID
    is_dead: bool

class MoveToScene(MasterSessionActionBase):
    msg_type: Literal['move_to_scene'] = 'move_to_scene'
    scene_id: UUID
    npc_id: Optional[UUID] = None
    item_id: Optional[UUID] = None

class MoveOutScene(MasterSessionActionBase):
    msg_type: Literal['move_out_scene'] = 'move_out_scene'
    scene_id: UUID
    npc_id: Optional[UUID] = None
    item_id: Optional[UUID] = None
    obstacle_id: Optional[UUID] = None


class AddScene(MasterSessionActionBase):
    msg_type: Literal['add_scene'] = 'add_scene'
    location_id: UUID



class UpdateSceneData(MasterSessionActionBase):
    msg_type: Literal['update_scene_data'] = 'update_scene_data'
    scene_id: UUID
    data: dict[str, Any]

class DelScene(MasterSessionActionBase):
    msg_type: Literal['del_scene'] = 'del_scene'
    scene_id: UUID

class MergeScene(MasterSessionActionBase):
    msg_type: Literal['merge_scene'] = 'merge_scene'
    scene_id: UUID
    to_scene_id: UUID

class SetMainScene(MasterSessionActionBase):
    msg_type: Literal['set_main_scene'] = 'set_main_scene'
    scene_id: UUID

class ExpandScene(MasterSessionActionBase):
    msg_type: Literal['scene_expand'] = 'scene_expand'
    scene_id: UUID

class CollapseScene(MasterSessionActionBase):
    msg_type: Literal['scene_collapse'] = 'scene_collapse'
    scene_id: UUID


class SetSceneLocation(MasterSessionActionBase):
    msg_type: Literal['set_scene_location'] = 'set_scene_location'
    scene_id: UUID
    location_id: UUID

class MoveCharacterToScene(MasterSessionActionBase):
    msg_type: Literal['move_character_to_scene'] = 'move_character_to_scene'
    scene_id: UUID
    character_id: UUID

class SetSceneTime(MasterSessionActionBase):
    msg_type: Literal['set_scene_time'] = 'set_scene_time'
    scene_id: UUID
    time: str

class MakeElementPublic(MasterSessionActionBase):
    msg_type: Literal['make_element_public'] = 'make_element_public'
    scene_id: UUID
    npc_id: Optional[UUID] = None
    item_id: Optional[UUID] = None
    obstacle_id: Optional[UUID] = None
    public: bool


class ApplyExposition(MasterSessionActionBase):
    msg_type: Literal['apply_exposition'] = 'apply_exposition'
    scene_id: UUID
    from_location_id: Optional[UUID] = None
    from_story_beat: Optional[UUID] = None
    exposition_id: UUID

