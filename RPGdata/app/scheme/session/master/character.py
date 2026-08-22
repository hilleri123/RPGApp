from typing import Optional, List, Literal, Dict, Any, Type, get_type_hints, get_origin
from pydantic import BaseModel, ConfigDict, ValidationError
from datetime import date, datetime
from uuid import UUID

from app.logger import logger
from ..base_actions import MasterSessionActionBase



class MasterUpdateStat(MasterSessionActionBase):
    msg_type: Literal['update_stat'] = 'update_stat'
    character_id: UUID

class MasterAddStat(MasterSessionActionBase):
    msg_type: Literal['add_stat'] = 'update_stat'
    character_id: UUID

