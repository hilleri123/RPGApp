from typing import Optional, List, Literal, Dict, Any, Type, get_type_hints, get_origin
from pydantic import BaseModel, ConfigDict, ValidationError, Field
from datetime import date, datetime
from uuid import UUID

from app.logger import logger
from app.scheme.notes import NoteCreate, CounterCreate
from ..base_actions import MasterSessionActionBase


class EditOwnedNote(MasterSessionActionBase):
    msg_type: Literal['edit_note'] = 'edit_note'
    note_id: UUID
    note: NoteCreate


class AddMessageReply(MasterSessionActionBase):
    msg_type: Literal['add_message_reply'] = 'add_message_reply'
    note_id: UUID
    text: str


class EditMessageReply(MasterSessionActionBase):
    msg_type: Literal['edit_message_reply'] = 'edit_message_reply'
    reply_id: UUID
    text: str


class DeleteMessageReply(MasterSessionActionBase):
    msg_type: Literal['delete_message_reply'] = 'delete_message_reply'
    reply_id: UUID


class CreateNoteAction(MasterSessionActionBase):
    msg_type: Literal['note_create'] = 'note_create'
    note: NoteCreate

class DeleteNoteAction(MasterSessionActionBase):
    msg_type: Literal['note_delete'] = 'note_delete'
    note_id: UUID


class NoteShownAction(MasterSessionActionBase):
    msg_type: Literal['note_shown'] = 'note_shown'
    note_id: UUID
    characters_ids: list[UUID] = Field(default_factory=list)



class MasterChangeNoteStatus(MasterSessionActionBase):
    msg_type: Literal['change_note_status'] = 'change_note_status'
    note_id: UUID
    status: Optional[Literal['pending', 'completed']] = None


class EditDispatch(MasterSessionActionBase):
    msg_type: Literal['edit_dispatch'] = 'edit_dispatch'
    dispatch_id: UUID
    note: NoteCreate


class RevokeDispatch(MasterSessionActionBase):
    msg_type: Literal['revoke_dispatch'] = 'revoke_dispatch'
    dispatch_id: UUID


class MarkDispatchOpened(MasterSessionActionBase):
    msg_type: Literal['mark_dispatch_opened'] = 'mark_dispatch_opened'
    dispatch_id: UUID


class CreateCounterAction(MasterSessionActionBase):
    msg_type: Literal['counter_create'] = 'counter_create'
    counter: CounterCreate

class DeleteCounterAction(MasterSessionActionBase):
    msg_type: Literal['counter_delete'] = 'counter_delete'
    counter_id: UUID


class CounterValueChangeAction(MasterSessionActionBase):
    msg_type: Literal['counter_value_change'] = 'counter_value_change'
    counter_id: UUID
    value: int
