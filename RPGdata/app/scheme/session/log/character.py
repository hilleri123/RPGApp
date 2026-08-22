from typing import Optional, List, Literal, Dict, Any, Type, get_type_hints, get_origin
from pydantic import BaseModel, ConfigDict, ValidationError
from datetime import date, datetime
from uuid import UUID

from ..base_log import LogMsgBase


class LogUpdateStat(LogMsgBase):
    log_type: Literal['update_stat'] = 'update_stat'
    character_id: UUID
    stat_id: UUID
    from_value: int
    to_value: int