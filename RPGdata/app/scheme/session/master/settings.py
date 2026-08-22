from typing import Optional, List, Literal, Dict, Any, Type, get_type_hints, get_origin
from pydantic import BaseModel, ConfigDict, ValidationError
from datetime import date, datetime
from uuid import UUID

from app.logger import logger
from ..base_actions import MasterSessionActionBase
from ..settings import Settings



class MasterSetSettings(MasterSessionActionBase):
    msg_type: Literal['set_settings'] = 'set_settings'
    settings: Settings


class MasterSetDefaultSettings(MasterSessionActionBase):
    msg_type: Literal['set_default_settings'] = 'set_default_settings'
