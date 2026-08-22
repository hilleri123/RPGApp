from typing import Optional, List, Literal, Dict, Any, Type, get_type_hints, get_origin
from pydantic import BaseModel, ConfigDict, ValidationError
from datetime import date, datetime
from uuid import UUID

from app.logger import logger
from ...location import LocationOut
from ..base_actions import MasterSessionActionBase


class SetLocationCheck(MasterSessionActionBase):
    msg_type: Literal['set_location_check'] = 'set_location_check'
    location_id: UUID
    polygon_id: UUID
    is_visible: bool



class SetNoteCheck(MasterSessionActionBase):
    msg_type: Literal['set_note_check'] = 'set_note_check'
    note_id: UUID
    is_checked: bool



class MoveCharacterToLocation(MasterSessionActionBase):
    msg_type: Literal['move_character_to_location'] = 'move_character_to_location'
    character_id: UUID
    location_id: UUID


class MasterToggleLocationHidden(MasterSessionActionBase):
    msg_type: Literal['toggle_location_hidden'] = 'toggle_location_hidden'
    location_id: UUID
    hidden: bool
