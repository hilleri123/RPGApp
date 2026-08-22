from typing import Optional, List, Literal
from uuid import UUID

from pydantic import Field

from app.scheme.notes import NoteCreate
from ..base_actions import PlayerSessionActionBase


class PlayerChangeNoteStatus(PlayerSessionActionBase):
    msg_type: Literal['change_note_status'] = 'change_note_status'
    note_id: UUID
    status: Optional[Literal['pending']] = None


class EditOwnedNote(PlayerSessionActionBase):
    msg_type: Literal['edit_note'] = 'edit_note'
    note_id: UUID
    note: NoteCreate


class PlayerCreateNote(PlayerSessionActionBase):
    msg_type: Literal['note_create'] = 'note_create'
    note: NoteCreate


class PlayerPublishNote(PlayerSessionActionBase):
    msg_type: Literal['note_shown'] = 'note_shown'
    note_id: UUID
    characters_ids: List[UUID] = Field(default_factory=list)
    include_master: bool = True


class AddMessageReply(PlayerSessionActionBase):
    msg_type: Literal['add_message_reply'] = 'add_message_reply'
    note_id: UUID
    text: str


class EditMessageReply(PlayerSessionActionBase):
    msg_type: Literal['edit_message_reply'] = 'edit_message_reply'
    reply_id: UUID
    text: str


class DeleteMessageReply(PlayerSessionActionBase):
    msg_type: Literal['delete_message_reply'] = 'delete_message_reply'
    reply_id: UUID


class PlayerDispatchNote(PlayerSessionActionBase):
    msg_type: Literal['dispatch_note'] = 'dispatch_note'
    note: NoteCreate
    character_ids: List[UUID] = Field(default_factory=list)
    include_master: bool = True


class PlayerMarkDispatchOpened(PlayerSessionActionBase):
    msg_type: Literal['mark_dispatch_opened'] = 'mark_dispatch_opened'
    dispatch_id: UUID


class PlayerEditDispatch(PlayerSessionActionBase):
    """Deprecated: use edit_note."""
    msg_type: Literal['edit_dispatch'] = 'edit_dispatch'
    dispatch_id: UUID
    note: NoteCreate
