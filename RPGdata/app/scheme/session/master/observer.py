from typing import Optional, List, Literal, Dict, Any, Type, get_type_hints, get_origin
from pydantic import BaseModel, ConfigDict, ValidationError, Field
from datetime import date, datetime
from uuid import UUID

from app.logger import logger
from app.scheme.notes import NoteCreate, CounterCreate
from ..base_actions import MasterSessionActionBase
from ..observer import Observer



class CreateObserver(MasterSessionActionBase):
    msg_type: Literal['create_observer'] = 'create_observer'

class UpdateObserver(MasterSessionActionBase):
    msg_type: Literal['update_observer'] = 'update_observer'
    observer: Observer

class DeleteObserver(MasterSessionActionBase):
    msg_type: Literal['delete_observer'] = 'delete_observer'
    code: str


