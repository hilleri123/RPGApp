from __future__ import annotations

from uuid import UUID, uuid4
from typing import Any, Optional, Tuple

from app import models, scheme
from app.logger import logger
from app.services.scenario_entities.common import with_db
from app.services.scenario_entities import npc as npc_service, items as item_service, characters as character_service

from .scene_manager import SessionSceneManager


class FactoryManager(SessionSceneManager):
    """
    Работа с фабричными объектами (InnerScenario.factories).
    """
    # --------- helpers ---------

    def _clone_item_from_factory(self, src: scheme.InnerFreeGameItem) -> scheme.InnerFreeGameItem:
        template_id = src.id
        data = src.model_dump(mode="json")
        data["id"] = uuid4()
        data["copied_from"] = str(template_id)
        data.pop("owner_id", None)
        data["location_id"] = None
        return scheme.InnerFreeGameItem(**data)

    def _clone_npc_from_factory(self, src: scheme.InnerNPC) -> scheme.InnerNPC:
        template_id = src.id
        data = src.model_dump(mode="json")
        data["id"] = uuid4()
        data["copied_from"] = str(template_id)
        data["location_id"] = None
        owned_items = []
        for it in data.get("owned_items") or []:
            item = scheme.InnerFreeGameItem(**it)
            cloned = self._clone_item_from_factory(item)
            owned_items.append(cloned.model_dump(mode="json"))
        data["owned_items"] = owned_items
        return scheme.InnerNPC(**data)

    def _clone_character_from_factory(self, src: scheme.InnerCharacter) -> scheme.InnerCharacter:
        template_id = src.id
        data = src.model_dump(mode="json")
        data["id"] = uuid4()
        data["copied_from"] = str(template_id)
        data["location_id"] = None
        data["player"] = None
        owned_items = []
        for it in data.get("owned_items") or []:
            item = scheme.InnerFreeGameItem(**it)
            cloned = self._clone_item_from_factory(item)
            owned_items.append(cloned.model_dump(mode="json"))
        data["owned_items"] = owned_items
        return scheme.InnerCharacter(**data)

    # --------- public API ---------

    async def create_factory_object(
        self,
        user: models.User,
        *,
        kind: str,
        object_id: UUID,
        scene_id: Optional[UUID] = None,
    ) -> Tuple[bool, list[str]]:
        """
        Создать объект из фабрики:
        kind: 'npc' | 'item' | 'character'
        object_id: id фабричного объекта (из factories.*)
        scene_id: опционально, куда сразу добавить.
        """
        inner = await self.get_inner()
        logger.info(f"create factory [{kind}] -> {object_id}")

        # master‑only, пока не усложняем
        if not (inner.master and inner.master.id == user.id):
            logger.info(f"Not a master ({user.id})")
            return False, []

        factories = inner.factories or []
        src = None

        if kind == "npc":
            for f in factories:
                for npc in f.npcs or []:
                    if npc.id == object_id:
                        src = npc
                        break
                if src:
                    break
            if not src:
                logger.warning("create_factory_object: npc not found in factories: %s", object_id)
                return False, []

            new_npc = self._clone_npc_from_factory(src)
            scenario_id = await self.get_scenario_id()
            npc_dict = new_npc.model_dump(mode="json")
            await with_db(
                lambda db: npc_service.upsert_npc_from_ws_dict(
                    db,
                    scenario_id=scenario_id,
                    npc_dict=npc_dict,
                    enriched_data=npc_dict.get("data") or {},
                    tags=npc_dict.get("tags") or [],
                    is_create=True,
                )
            )
            await self.invalidate_entity_cache()

            if scene_id:
                scenes = list((await self.get_runtime()).scenes or [])
                for s in scenes:
                    if s.id == scene_id:
                        s.private.npc_ids = list(s.private.npc_ids or [])
                        s.private.npc_ids.append(new_npc.id)
                        break
                await self._save_scenes(scenes)

            return True, ["npcs", "scenes"]

        if kind == "character":
            for f in factories:
                for ch in f.characters or []:
                    if ch.id == object_id:
                        src = ch
                        break
                if src:
                    break
            if not src:
                logger.warning("create_factory_object: character not found in factories: %s", object_id)
                return False, []

            new_ch = self._clone_character_from_factory(src)
            scenario_id = await self.get_scenario_id()
            ch_dict = new_ch.model_dump(mode="json")
            await with_db(
                lambda db: character_service.create_character_from_ws_dict(
                    db,
                    scenario_id=scenario_id,
                    ch_dict=ch_dict,
                    enriched_data=ch_dict.get("data") or {},
                    tags=ch_dict.get("tags") or [],
                )
            )
            await self.invalidate_entity_cache()

            if scene_id:
                scenes = list((await self.get_runtime()).scenes or [])
                for s in scenes:
                    if s.id == scene_id:
                        s.character_ids = list(s.character_ids or [])
                        s.character_ids.append(new_ch.id)
                        break
                await self._save_scenes(scenes)

            return True, ["characters", "scenes"]

        if kind == "item":
            for f in factories:
                for it in f.items or []:
                    if it.id == object_id:
                        src = it
                        break
                if src:
                    break
            if not src:
                logger.warning("create_factory_object: item not found in factories: %s", object_id)
                return False, []

            new_item = self._clone_item_from_factory(src)
            scenario_id = await self.get_scenario_id()
            item_dict = new_item.model_dump(mode="json")
            await with_db(
                lambda db: item_service.upsert_item_from_ws_dict(
                    db,
                    scenario_id=scenario_id,
                    item_dict=item_dict,
                    is_create=True,
                )
            )
            await self.invalidate_entity_cache()

            if scene_id:
                scenes = list((await self.get_runtime()).scenes or [])
                for s in scenes:
                    if s.id == scene_id:
                        s.private = self._ensure_scene_elements(s.private)
                        s.private.item_ids = list(s.private.item_ids or [])
                        s.private.item_ids.append(new_item.id)
                        break
                await self._save_scenes(scenes)

            return True, ["items", "scenes"]

        logger.warning("create_factory_object: unsupported kind=%r", kind)
        return False, []
