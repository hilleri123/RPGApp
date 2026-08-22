# app/managers/session/npc_manager.py
from __future__ import annotations

from uuid import UUID, uuid4
from typing import Any, List, Optional

from sqlalchemy import Tuple

from app import models, scheme
from app.logger import logger

from app.services.scenario_entities.common import with_db
from .data_manager import SessionDataManager
from .scene_manager import SessionSceneManager
from .user_manager import SessionUserManager


class SessionNPCManager(SessionSceneManager, SessionUserManager, SessionDataManager):
    """
    Новый контракт:
    - NPC лежат в inner.npcs (список объектов)
    - owned_items лежат внутри NPC (NPCOut.owned_items)
    - items в inner.items — только free items (не касается NPC напрямую)
    """

    def __init__(self, session_id: UUID | str):
        super().__init__(str(session_id))

    async def _upsert_npc_in_inner(self, npc: scheme.NPCOut) -> bool:
        """
        Возвращает True если заменили, False если добавили.
        """
        inner = await self.get_inner()
        npcs = list(inner.npcs or [])

        replaced = False
        for i, n in enumerate(npcs):
            if n.id == npc.id:
                npcs[i] = npc
                replaced = True
                break

        if not replaced:
            npcs.append(npc)

        # Пишем обратно только поле npcs (а не весь inner)
        await self.set_field("npcs", [x.model_dump(mode="json") for x in npcs])
        return replaced

    async def _delete_npc_from_inner(self, npc_id: UUID) -> bool:
        inner = await self.get_inner()
        npcs = list(inner.npcs or [])
        new_npcs = [n for n in npcs if n.id != npc_id]
        if len(new_npcs) == len(npcs):
            return False

        await self.set_field("npcs", [x.model_dump(mode="json") for x in new_npcs])

        # дополнительно: убрать npc из всех сцен (id-ориентированных)
        scenes = await self.get_scenes() or []
        changed = False
        for s in scenes:
            if npc_id in (s.public.npc_ids or []):
                s.public.npc_ids = [x for x in s.public.npc_ids if x != npc_id]
                changed = True
            if npc_id in (s.private.npc_ids or []):
                s.private.npc_ids = [x for x in s.private.npc_ids if x != npc_id]
                changed = True
        if changed:
            await self.set_field("scenes", [s.model_dump(mode="json") for s in scenes])

        return True

    # ---- public API (ws actions) ----
    async def make_npc_dead(self, npc_id: UUID, is_dead: bool):
        inner = await self.get_inner()
        npcs = list(inner.npcs or [])
        for npc in npcs:
            if npc.id == npc_id:
                # у тебя в NPCOut может не быть is_dead — тогда положи в npc.data или отдельное поле
                if hasattr(npc, "is_dead"):
                    npc.is_dead = is_dead
                else:
                    data = dict(getattr(npc, "data", None) or {})
                    data["is_dead"] = is_dead
                    npc.data = data

                await self.set_field("npcs", [x.model_dump(mode="json") for x in npcs])

                await self.add_log(
                    scheme.LogMsgBase(  # замени на конкретный тип лога если есть
                        # если у тебя нет такого конструктора — просто убери лог
                    )
                )
                return True, ["npcs"]  # можно добавить "logs" если реально пишешь лог
        return False, []

    async def upsert_npc_from_db(self, npc_out: scheme.NPCOut):
        """
        Это метод “мост” для HTTP CRUD:
        после create/update NPC в БД ты вызываешь его,
        чтобы npc оказался в активной сессии в Redis.
        """
        await self._upsert_npc_in_inner(npc_out)
        return True, ["npcs"]

    async def delete_npc(self, current_user: models.User, npc_id: UUID):
        ok = await self._delete_npc_from_inner(npc_id)
        return (ok, ["npcs", "scenes"] if ok else [])

    async def create_npc(
        self,
        current_user: models.User,
        scene_id: UUID | str,
        npc: Any,  # npc может быть dict или pydantic (с фронта)
    ) -> Tuple[bool, List[str]]:
        # 1) только мастер
        if not await self.is_master(current_user):
            return False, []

        # 2) нормализуем вход
        if hasattr(npc, "model_dump"):
            npc_dict = npc.model_dump(mode="json")
        else:
            npc_dict = dict(npc or {})

        logger.info(f"{npc=}")
        npc_id = npc_dict.get("id") or str(uuid4())
        npc_data = npc_dict.get("data") or {}
        npc_tags = npc_dict.get("tags") or []
        force = bool(npc_dict.get("force", False))

        # 3) enrich/validate data (как REST)
        inner = await self.get_inner()

        ok, issues, enriched, new_tags = await self.validate_data(
            entity="npc",
            data=npc_data,
            tags=npc_tags,
            context={}
        )

        # если db нельзя достать — используй вариант ниже с параметром db
        # (см. секцию 2)

        if (not ok) and (not force):
            # контракт WS: create_npc возвращает ok/fields, а issues идут через validate_npc RPC
            return False, []

        # 5) persist to DB
        scenario_id = await self.get_scenario_id()
        from app.services.scenario_entities import npc as npc_service
        await with_db(
            lambda db: npc_service.upsert_npc_from_ws_dict(
                db,
                scenario_id=scenario_id,
                npc_dict=npc_dict,
                enriched_data=enriched,
                tags=new_tags,
                is_create=True,
            )
        )
        await self.invalidate_entity_cache()

        new_npc_id = UUID(str(npc_id)) if not isinstance(npc_id, UUID) else npc_id

        # 6) добавить на сцену (по умолчанию private)
        moved = await self._add_npc_to_scene(scene_id, new_npc_id, is_public=False)

        fields = ["npcs"]
        if moved:
            fields.append("scenes")

        return True, fields


    async def update_npc(
        self,
        current_user: models.User,
        scene_id: UUID | str,
        npc: Any,  # npc может быть dict или pydantic (с фронта)
        ensure_in_scene: bool = False,  # опционально: если True, то добавим npc в private если его нет
    ) -> Tuple[bool, List[str]]:
        # 1) только мастер
        if not await self.is_master(current_user):
            return False, []

        # 2) нормализуем вход
        if hasattr(npc, "model_dump"):
            npc_dict = npc.model_dump(mode="json")
        else:
            npc_dict = dict(npc or {})

        npc_id = npc_dict.get("id")
        if not npc_id:
            # update без id — это фактически create, но по твоему требованию пусть будет ошибка/false
            logger.warning("update_npc: missing npc.id")
            return False, []

        npc_data = npc_dict.get("data") or {}
        npc_tags = npc_dict.get("tags") or []
        force = bool(npc_dict.get("force", False))

        ok, issues, enriched, new_tags = await self.validate_data(
            entity="npc",
            data=npc_data,
            tags=npc_tags,
            context={}
        )

        if (not ok) and (not force):
            # контракт WS: ok/fields, issues уходят через validate_entity RPC
            return False, []

        npc_uuid = UUID(str(npc_id)) if not isinstance(npc_id, UUID) else npc_id

        scenario_id = await self.get_scenario_id()
        from app.services.scenario_entities import npc as npc_service
        await with_db(
            lambda db: npc_service.upsert_npc_from_ws_dict(
                db,
                scenario_id=scenario_id,
                npc_dict={**npc_dict, "id": str(npc_uuid)},
                enriched_data=enriched,
                tags=new_tags,
                is_create=False,
            )
        )
        await self.invalidate_entity_cache()

        fields: List[str] = ["npcs", "scenes"]

        moved = False
        if ensure_in_scene:
            moved = await self._add_npc_to_scene(scene_id, npc_uuid, is_public=False)
            if moved:
                fields.append("scenes")

        return True, fields


    async def _add_npc_to_scene(self, scene_id: UUID | str, npc_id: UUID, is_public: bool) -> bool:
        raw_scenes = await self.get_scenes() or []
        sid = UUID(str(scene_id)) if not isinstance(scene_id, UUID) else scene_id

        # 1) привести к pydantic моделям
        scenes: list[scheme.SceneInner] = []
        for s in raw_scenes:
            scenes.append(s if hasattr(s, "model_dump") else scheme.SceneInner.model_validate(s))

        changed = False
        for s in scenes:
            if s.id != sid:
                continue

            bucket = s.public if is_public else s.private
            ids = list(bucket.npc_ids or [])
            if npc_id not in ids:
                ids.append(npc_id)
                bucket.npc_ids = ids
                changed = True
            break

        if changed:
            await self.set_field("scenes", [x.model_dump(mode="json") for x in scenes])

        return changed



    async def _remove_npc_id_from_all_scenes(self, npc_id: UUID) -> bool:
        raw_scenes = await self.get_scenes() or []

        scenes: list[scheme.SceneInner] = []
        for s in raw_scenes:
            scenes.append(s if hasattr(s, "model_dump") else scheme.SceneInner.model_validate(s))

        changed = False
        for s in scenes:
            # на всякий: public/private могут быть None
            if s.public is not None and getattr(s.public, "npc_ids", None):
                before = len(s.public.npc_ids)
                s.public.npc_ids = [x for x in s.public.npc_ids if x != npc_id]
                if len(s.public.npc_ids) != before:
                    changed = True

            if s.private is not None and getattr(s.private, "npc_ids", None):
                before = len(s.private.npc_ids)
                s.private.npc_ids = [x for x in s.private.npc_ids if x != npc_id]
                if len(s.private.npc_ids) != before:
                    changed = True

        if changed:
            await self.set_field("scenes", [x.model_dump(mode="json") for x in scenes])

        return changed

    async def delete_npc_permanently(
        self,
        current_user: models.User,
        npc_id: UUID | str,
    ) -> Tuple[bool, List[str]]:
        # 1) только мастер
        if not await self.is_master(current_user):
            return False, []

        # 2) normalize id
        npc_uuid = UUID(str(npc_id)) if not isinstance(npc_id, UUID) else npc_id

        from app.services.scenario_entities import npc as npc_service
        deleted = await with_db(lambda db: npc_service.delete_npc(db, npc_id=npc_uuid))
        if not deleted:
            logger.warning(f"delete_npc_permanently: npc not found: {npc_uuid}")
            return False, []

        await self.invalidate_entity_cache()

        scenes_changed = await self._remove_npc_id_from_all_scenes(npc_uuid)

        fields: List[str] = ["npcs"]
        if scenes_changed:
            fields.append("scenes")

        # 5) (опционально) лог
        # await self.add_log(scheme.LogNpcDeleted(user_id=..., npc_id=npc_uuid))
        # fields.append("logs")

        return True, fields
