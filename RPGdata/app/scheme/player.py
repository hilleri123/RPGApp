from typing import Optional
from datetime import datetime, timezone
from pydantic import BaseModel, ConfigDict, HttpUrl
from uuid import UUID

from .auth import User
from .character import PlayerCharacter


class PlayerBase(BaseModel):
    game_session_id: Optional[UUID] = None
    character_id: Optional[UUID] = None
    name: str

class PlayerCreate(PlayerBase):
    pass

class Player(PlayerBase):
    id: UUID
    # Только runtime лобби (Redis), не пишется в ORM models.Player при became_player.
    application_id: Optional[UUID] = None
    joined_at: Optional[datetime] = datetime.now(timezone.utc)
    user: User
    is_ready: Optional[bool] = False
    is_active: bool = True
    color: Optional[str] = "#ffffff"

    icon_url: Optional[HttpUrl]
    img_url: Optional[HttpUrl]

    model_config = ConfigDict(
        ser_json_encoders={
            datetime: lambda v: v.isoformat()
        },
        from_attributes=True
    )


class PlayerWithCharacter(Player):
    character: Optional[PlayerCharacter] = None