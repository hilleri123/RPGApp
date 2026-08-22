from typing import Literal
from app.scheme.game_item import GameItem
from app.scheme.notes import Note
from app.scheme.session.base_notifications import NotificationBase


class NoteShownNotification(NotificationBase):
    notif_type: Literal["note_shown"] = "note_shown"
    note: Note
    