
from uuid import UUID
from typing import List, Optional
from pydantic import BaseModel



class AudioTrackOut(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    url: str
    duration: Optional[int] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    tags: Optional[list[str]] = None
    created_by: Optional[UUID] = None

    model_config = {"from_attributes": True}


class AudioTrackUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[list] = None


class ExposureAudioLinkIn(BaseModel):
    audio_track_id: UUID
    volume: float = 0.5
    loop: bool = True
    fade_in: float = 2.0
    fade_out: float = 2.0
    order_num: int = 0


class ExposureAudioLinkOut(BaseModel):
    audio_track_id: UUID
    volume: float
    loop: bool
    fade_in: float
    fade_out: float
    order_num: int
    audio_track: AudioTrackOut

    model_config = {"from_attributes": True}