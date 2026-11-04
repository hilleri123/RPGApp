import uuid
from redis.commands.json.path import Path
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import or_
from typing import List, Optional
from app.infrastructure.redis_service import redis_client
from app import models, scheme
from app.infrastructure.database import get_async_session as get_db
from app.routes.scenarios.full import read_scenario
from app.logger import logger


from .data_manager import SessionDataManager

class SessionUserManager(SessionDataManager):
    def __init__(self, session_id: uuid.UUID):
        super().__init__(session_id)

    async def is_master(self, user: models.User) -> bool:
        data = await redis_client.json().get(
            self._session_key(),
            self._m_path('master')
        )
        master = scheme.User(**data)
        return master.id == user.id

    async def is_player(self, user: models.User) -> bool:
        players = await redis_client.json().get(
            self._session_key(),
            self._m_path('players')
        )
        for data in players:
            p = scheme.Player(**data)
            if p.user.id == user.id:
                return True
        return False
    

    async def get_recipients(self) -> List[scheme.User]:
        res = []
        data = await self.get_field('master')
        master = scheme.User(**data)
        res.append(master)
        players = await self.get_field('players')
        res += [scheme.Player(**data).user for data in players]
        return res

    async def scene_cue_speaker(self, user: models.User) -> dict | None:
        """Имя, аватар персонажа и цвет игрока для тоста. В журнал не пишется."""
        if not await self.is_player(user):
            return None
        inner = await self.get_inner()
        player = next(
            (p for p in (inner.players or []) if str(p.user.id) == str(user.id)),
            None,
        )
        if player is None or not player.character_id:
            return None
        character = next(
            (c for c in (inner.characters or []) if str(c.id) == str(player.character_id)),
            None,
        )
        source = character or getattr(player, "character", None)
        name = getattr(source, "name", None)
        if not name:
            return None
        icon = getattr(source, "icon_url", None) or getattr(source, "img_url", None)
        return {
            "name": name,
            "icon_url": str(icon) if icon else None,
            "color": getattr(player, "color", None) or "#ffffff",
        }
