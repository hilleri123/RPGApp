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
