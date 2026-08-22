from typing import Optional, List, Literal, Dict, Any, Type, get_type_hints, get_origin
from pydantic import BaseModel, ConfigDict, ValidationError
from datetime import date, datetime
from uuid import UUID

from app.logger import logger
from ..base_actions import MasterSessionActionBase



class MasterReadNotifications(MasterSessionActionBase):
    msg_type: Literal['read_notifications'] = 'read_notifications'
    notifications_ids: list[UUID]
