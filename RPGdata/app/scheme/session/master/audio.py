from typing import Optional, List, Literal, Dict, Any, Type, get_type_hints, get_origin
from pydantic import BaseModel, ConfigDict, ValidationError
from datetime import date, datetime
from uuid import UUID

from app.logger import logger
from ..base_actions import MasterSessionActionBase


class AudioCommand(MasterSessionActionBase):
    msg_type: Literal["audio_command"] = "audio_command"
    command: str

class AudioCommandPlayEntry(MasterSessionActionBase):
    msg_type: Literal["audio_command_play_entry"] = "audio_command_play_entry"
    entry_id: str

class AudioCommandSetVolume(MasterSessionActionBase):       # ← NEW
    msg_type: Literal["audio_command_set_volume"] = "audio_command_set_volume"
    volume: float

class AudioCommandSyncPosition(MasterSessionActionBase):   # ← NEW
    msg_type: Literal["audio_command_sync_position"] = "audio_command_sync_position"
    position_sec: float


class AudioCommandEnqueueTrack(MasterSessionActionBase):
    msg_type: Literal["audio_command_enqueue_track"] = "audio_command_enqueue_track"
    audio_track_id: UUID
    play: bool = True