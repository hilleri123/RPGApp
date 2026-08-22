from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime, timezone
from typing import Literal, Optional


class AudioQueueReason(BaseModel):
    type: Literal["exposure_applied"] = "exposure_applied"
    exposure_id: UUID
    exposure_name: str
    source_type: Literal["location", "story_beat"]
    source_name: str
    source_id: UUID
    scene_name: Optional[str] = None
    scene_id: Optional[UUID] = None

class AudioQueueEntry(BaseModel):
    id: UUID                        # уникальный id записи в очереди
    audio_track_id: UUID
    track_name: str                 # денормализовано для удобства
    track_url: str
    track_duration: Optional[float] = None
    volume: float = 0.5
    loop: bool = True
    fade_in: float = 2.0
    fade_out: float = 2.0
    added_at: datetime
    played: bool = False
    reason: AudioQueueReason



class AudioPlayerState(BaseModel):
    """Состояние аудиоплеера сессии."""
    current_entry_id: Optional[UUID] = None
    playing: bool = False
    volume: float = 1.0
    position_sec: float = 0.0
    position_at: Optional[datetime] = None  # когда записана позиция

    def effective_position(self) -> float:
        """Реальная позиция с учётом прошедшего времени."""
        if self.playing and self.position_at:
            elapsed = (datetime.now(timezone.utc) - self.position_at).total_seconds()
            return max(0.0, self.position_sec + elapsed)
        return self.position_sec