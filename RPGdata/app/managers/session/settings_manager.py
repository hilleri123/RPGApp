from uuid import UUID
from typing import Any, Optional

from fastapi import HTTPException, status
from redis.commands.json.path import Path

from app import models, scheme
from app.infrastructure.redis_service import redis_client
from app.logger import logger
from app.auth.permissions import can_edit_scenario_meta, get_scenario_permission
from app.infrastructure.database import get_async_session as get_db

from .user_manager import SessionUserManager


class SessionSettingsManager(SessionUserManager):
    def __init__(self, session_id: UUID):
        super().__init__(session_id)


    async def _can_edit_scenario(self, user: models.User, scenario_id: UUID) -> bool:
        async for db in get_db():
            scenario = await db.get(models.Scenario, scenario_id)
            if not scenario:
                return False
            perm = await get_scenario_permission(db, user, scenario)
            return can_edit_scenario_meta(perm)
        return False


    async def set_settings(self, user: models.User, settings: scheme.Settings) -> tuple:
        inner = await self.get_inner()
        if not await self.is_master(user):
            raise HTTPException(status_code=403, detail="master role required")

        payload = settings.model_dump(mode="json")
        ok = await redis_client.json().set(
            self._session_key(),
            self._m_path("settings"),
            payload,
        )
        if not ok:
            raise HTTPException(status_code=404, detail="session not found in redis")

        return True, ["settings", "scenes", "actions"]

    async def reset_settings(self, user: models.User) -> scheme.Settings:
        """
        Сброс settings к дефолту. Только мастер.
        """
        default = scheme.Settings()
        await self.set_settings(user, default)
        return True, ["settings", "scenes", "actions"]

