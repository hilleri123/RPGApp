# app/managers/session/npc_manager.py
from __future__ import annotations

from uuid import UUID, uuid4
from typing import Any, List, Optional

from sqlalchemy import Tuple

from app import models, scheme
from app.logger import logger

from .data_manager import SessionDataManager  # или откуда у тебя он импортится
from .scene_manager import SessionSceneManager        # если нужен move_to_scene и т.п.
from .user_manager import SessionUserManager          # если нужен own/is_master


class SessionObstacleManager(SessionSceneManager, SessionUserManager, SessionDataManager):
    def __init__(self, session_id: UUID | str):
        super().__init__(str(session_id))

    async def _upsert_obstacle_in_inner(self, obstacle: scheme.ObstacleOut) -> bool:
        """
        Обновляет или добавляет препятствие в общем списке inner.obstacles
        и записывает его data/tags в БД (см. set_field).
        """
        inner = await self.get_inner()
        obstacles = list(inner.obstacles or [])

        found = False
        for i, ob in enumerate(obstacles):
            if str(ob.id) == str(obstacle.id):
                obstacles[i] = obstacle
                found = True
                break

        if not found:
            obstacles.append(obstacle)

        await self.set_field("obstacles", [x.model_dump(mode="json") for x in obstacles])
        return found

    async def _add_obstacle_to_scene(
        self,
        scene_id: UUID | str,
        obstacle: scheme.ObstacleOut,
    ) -> bool:
        """
        Кладёт obstacle в scene.private.obstacles (по аналогии с apply_exposition).
        """
        inner = await self.get_inner()
        scenes = list(inner.scenes or [])
        scene = next((s for s in scenes if str(s.id) == str(scene_id)), None)
        if not scene:
            logger.warning("_add_obstacle_to_scene: scene not found %s", scene_id)
            return False

        scene.private = self._ensure_scene_elements(scene.private)
        scene.public = self._ensure_scene_elements(scene.public)

        updated = False
        ob_id_str = str(obstacle.id)

        # 1) пробуем обновить в private
        private_obstacles = list(scene.private.obstacles or [])
        for i, ob in enumerate(private_obstacles):
            if str(ob.id) == ob_id_str:
                private_obstacles[i] = obstacle
                updated = True
                break

        # 2) если не нашли в private — пробуем обновить в public
        if not updated:
            public_obstacles = list(scene.public.obstacles or [])
            for i, ob in enumerate(public_obstacles):
                if str(ob.id) == ob_id_str:
                    public_obstacles[i] = obstacle
                    updated = True
                    break
            scene.public.obstacles = public_obstacles
        else:
            scene.private.obstacles = private_obstacles

        # 3) если нигде не нашли — добавляем в private
        if not updated:
            private_obstacles.append(obstacle)
            scene.private.obstacles = private_obstacles

        await self._save_scenes(scenes)
        return True


    async def create_obstacle(
        self,
        current_user: models.User,
        scene_id: UUID | str,
        obstacle: Any,  # dict или pydantic с фронта
    ) -> Tuple[bool, List[str]]:
        # 1) только мастер
        if not await self.is_master(current_user):
            return False, []

        # 2) нормализуем вход
        if hasattr(obstacle, "model_dump"):
            ob_dict = obstacle.model_dump(mode="json")
        else:
            ob_dict = dict(obstacle or {})

        logger.info("create_obstacle: %s", ob_dict)

        ob_id = ob_dict.get("id") or str(uuid4())
        data = ob_dict.get("data") or {}
        tags = ob_dict.get("tags") or []
        force = bool(ob_dict.get("force", False))

        ok, issues, enriched, new_tags = await self.validate_data(
            entity="obstacle",
            data=data,
            tags=tags,
            context={"scene_id": str(scene_id)},
        )

        if (not ok) and (not force):
            # контракт как у npc: ок/fields, issues уходят через validate_entity
            return False, []

        # 4) собрать препятствие (ObstacleOut / InnerObstacle)
        ob = scheme.ObstacleOut(
            id=UUID(str(ob_id)) if not isinstance(ob_id, UUID) else ob_id,
            name=ob_dict.get("name") or "",
            description_for_master=ob_dict.get("description_for_master"),
            description_for_players=ob_dict.get("description_for_players"),
            data=enriched,
            tags=new_tags,
        )

        # 5) сохранить в inner (если есть глобальный список препятствий)
        await self._upsert_obstacle_in_inner(ob)

        # 6) положить в сцену (private.obstacles)
        moved = await self._add_obstacle_to_scene(scene_id, ob)

        fields: List[str] = []
        if moved:
            fields.append("scenes")
        # если ты ведёшь общий список препятствий в inner — можно добавить "counters"/"obstacles"
        # в зависимости от того, как у тебя это интегрировано
        return True, fields

    async def update_obstacle(
        self,
        current_user: models.User,
        scene_id: UUID | str,
        obstacle: Any
    ) -> Tuple[bool, List[str]]:
        # 1) только мастер
        if not await self.is_master(current_user):
            return False, []

        # 2) нормализуем вход
        if hasattr(obstacle, "model_dump"):
            ob_dict = obstacle.model_dump(mode="json")
        else:
            ob_dict = dict(obstacle or {})

        ob_id = ob_dict.get("id")
        if not ob_id:
            logger.warning("update_obstacle: missing obstacle.id")
            return False, []

        data = ob_dict.get("data") or {}
        tags = ob_dict.get("tags") or []
        force = bool(ob_dict.get("force", False))

        # 3) validate/enrich data
        inner = await self.get_inner()

        ok, issues, enriched, new_tags = await self.validate_data(
            entity="obstacle",
            data=data,
            tags=tags,
            context={"scene_id": str(scene_id)},
        )

        if (not ok) and (not force):
            return False, []

        ob_uuid = UUID(str(ob_id)) if not isinstance(ob_id, UUID) else ob_id

        # 4) собрать обновлённую модель
        updated = scheme.ObstacleOut(
            id=ob_uuid,
            name=ob_dict.get("name") or "",
            description_for_master=ob_dict.get("description_for_master"),
            description_for_players=ob_dict.get("description_for_players"),
            data=enriched,
            tags=new_tags,
        )

        # 5) upsert в inner
        await self._upsert_obstacle_in_inner(updated)

        # 6) при необходимости убедиться, что он есть в сцене
        fields: List[str] = ["scenes"]

        moved = await self._add_obstacle_to_scene(scene_id, updated)


        return True, fields