from __future__ import annotations

from uuid import UUID, uuid4
from typing import Any, Optional, Tuple, Literal

from app import models, scheme
from app.logger import logger
from app.services.scenario_entities.common import with_db
from app.services.scenario_entities import items as item_service

from .scene_manager import SessionSceneManager

OwnerKind = Literal["free", "character", "npc"]


class SessionItemManager(SessionSceneManager):
    """
    Новый контракт:
    - inner.items: только free items (без владельца)
    - character/npc хранят предметы внутри owned_items/owneditems
    - сцены: item_ids остаются ссылками по UUID
    """

    # ---------- helpers ----------
    async def _get_state(self) -> scheme.GameSessionInner:
        return await self.get_inner()

    def _find_character(self, inner: scheme.GameSessionInner, character_id: UUID):
        return next((c for c in (inner.characters or []) if c.id == character_id), None)

    def _find_npc(self, inner: scheme.GameSessionInner, npc_id: UUID):
        return next((n for n in (inner.npcs or []) if n.id == npc_id), None)

    def _get_owned_list(self, owner_obj) -> list:
        # поддерживаем оба поля: owned_items и owneditems
        if hasattr(owner_obj, "owned_items") and owner_obj.owned_items is not None:
            return list(owner_obj.owned_items)
        if hasattr(owner_obj, "owneditems") and owner_obj.owneditems is not None:
            return list(owner_obj.owneditems)
        return []

    def _set_owned_list(self, owner_obj, items: list) -> None:
        if hasattr(owner_obj, "owned_items"):
            owner_obj.owned_items = items
        elif hasattr(owner_obj, "owneditems"):
            owner_obj.owneditems = items
        else:
            # если внезапно нет ни одного поля — молча игнор/или raise
            pass

    def _remove_owned_item(self, owner_obj, item_id: UUID) -> Optional[scheme.GameItemOut]:
        owned = self._get_owned_list(owner_obj)
        found = None
        new_owned = []
        for it in owned:
            if it.id == item_id:
                found = it
            else:
                new_owned.append(it)
        self._set_owned_list(owner_obj, new_owned)
        return found

    def _append_owned_item(self, owner_obj, item) -> None:
        owned = self._get_owned_list(owner_obj)
        owned.append(item)
        self._set_owned_list(owner_obj, owned)

    def _find_item_anywhere(
        self,
        inner: scheme.GameSessionInner,
        item_id: UUID
    ) -> Tuple[Optional[scheme.GameItemOut], OwnerKind, Optional[UUID]]:
        # 1) free items
        for it in (inner.items or []):
            if it.id == item_id:
                return it, "free", None

        # 2) characters
        for ch in (inner.characters or []):
            for it in self._get_owned_list(ch):
                if it.id == item_id:
                    return it, "character", ch.id

        # 3) npcs
        for npc in (inner.npcs or []):
            for it in self._get_owned_list(npc):
                if it.id == item_id:
                    return it, "npc", npc.id

        return None, "free", None

    async def _remove_item_from_any_scene(self, item_id: UUID) -> None:
        # тут важный момент: get_scenes() из SessionDataManager возвращает то, что лежит в Redis.
        # В твоём SessionSceneManager ты работаешь с inner.scenes и сохраняешь через _save_scenes(),
        # поэтому здесь лучше оперировать через inner и _save_scenes().
        inner = await self.get_inner()
        scenes = list(inner.scenes or [])
        updated = False

        for scene in scenes:
            scene.public = self._ensure_scene_elements(scene.public)
            scene.private = self._ensure_scene_elements(scene.private)

            if item_id in (scene.public.item_ids or []):
                scene.public.item_ids = [x for x in (scene.public.item_ids or []) if x != item_id]
                updated = True

            if item_id in (scene.private.item_ids or []):
                scene.private.item_ids = [x for x in (scene.private.item_ids or []) if x != item_id]
                updated = True

        if updated:
            await self._save_scenes(scenes)

    async def _save_free_items(self, inner: scheme.GameSessionInner) -> None:
        await self.set_field("items", [it.model_dump(mode="json") for it in (inner.items or [])])

    async def _save_characters(self, inner: scheme.GameSessionInner) -> None:
        await self.set_field("characters", [c.model_dump(mode="json") for c in (inner.characters or [])])

    async def _save_npcs(self, inner: scheme.GameSessionInner) -> None:
        await self.set_field("npcs", [n.model_dump(mode="json") for n in (inner.npcs or [])])

    async def _persist(self, inner: scheme.GameSessionInner, *, save_items=True, save_characters=True, save_npcs=True) -> None:
        await self.invalidate_entity_cache()

    async def _transfer_item_db(
        self,
        item_id: UUID,
        *,
        to_character_id: UUID | None = None,
        to_npc_id: UUID | None = None,
    ) -> None:
        await with_db(
            lambda db: item_service.transfer_item_ownership(
                db,
                item_id=item_id,
                to_character_id=to_character_id,
                to_npc_id=to_npc_id,
            )
        )
        await self.invalidate_entity_cache()

    # ---------- auth ----------
    async def own(self, user: models.User, character_id: UUID = None) -> bool:
        inner = await self.get_inner()

        # master can do anything
        if inner.master and str(inner.master.id) == str(user.id):
            return True

        if character_id is None:
            return False

        # player owns the item if his player.character_id == character_id
        for p in (inner.players or []):
            # у тебя в PlayerWithCharacter: p.user.id и p.character_id есть (по использованию выше)
            if str(p.user.id) == str(user.id):
                return str(p.character_id) == str(character_id)

        return False

    # ---------- actions ----------
    async def move_item(
        self,
        user: models.User,
        item_id: UUID,
        to_character_id: UUID = None,
        to_npc_id: UUID = None,
        to_location_id: UUID = None,
    ) -> Tuple[bool, list[str]]:
        inner = await self._get_state()

        item, owner_kind, owner_id = self._find_item_anywhere(inner, item_id)
        if not item:
            return False, []

        # права: если предмет у персонажа — проверяем own
        if owner_kind == "character":
            if not await self.own(user, character_id=owner_id):
                return False, []

        # npc-ownership: master-only
        if owner_kind == "npc":
            if not (inner.master and str(inner.master.id) == str(user.id)):
                return False, []

        # убираем из сцен (как было)
        await self._remove_item_from_any_scene(item_id)

        if to_character_id:
            await self._transfer_item_db(item_id, to_character_id=to_character_id)
            await self.add_log(scheme.LogItemMove(user_id=user.id, item_id=item_id))
            return True, ["items", "characters", "scenes", "logs"]

        if to_npc_id:
            await self._transfer_item_db(item_id, to_npc_id=to_npc_id)
            await self.add_log(scheme.LogItemMove(user_id=user.id, item_id=item_id))
            return True, ["items", "npcs", "scenes", "logs"]

        await self._transfer_item_db(item_id)

        if to_location_id:
            scene = next((s for s in (inner.scenes or []) if s.location_id == to_location_id), None)
            if scene:
                await self.move_to_scene(scene.id, item_id=item_id, private=False)

        await self.add_log(scheme.LogItemMove(user_id=user.id, item_id=item_id))
        return True, ["items", "characters", "npcs", "scenes", "logs"]

    async def drop_item(self, user: models.User, item_id: UUID) -> Tuple[bool, list[str]]:
        inner = await self._get_state()

        # находим player и его character_id
        player = next((p for p in (inner.players or []) if str(p.user.id) == str(user.id)), None)
        if not player or not getattr(player, "character_id", None):
            return False, []

        ch = self._find_character(inner, player.character_id)
        if not ch:
            return False, []

        item = next((it for it in self._get_owned_list(ch) if it.id == item_id), None)
        if not item:
            return False, []

        await self._transfer_item_db(item_id)

        cid = str(player.character_id)
        scene = next(
            (
                s for s in (inner.scenes or [])
                if cid in {str(x) for x in (s.character_ids or [])}
            ),
            None,
        )
        fields = ["items", "characters", "scenes", "logs"]
        if scene:
            await self.move_to_scene(scene.id, item_id=item_id, private=False)
            # Public drop should be visible to players via seen (same as make_element_public).
            try:
                inner2 = await self.get_inner()
                inner2.seen.add(item_id)
                await self._save_seen(inner2.seen, added={item_id})
            except Exception:
                logger.exception("drop_item: failed to mark item seen id=%s", item_id)

        await self.add_log(scheme.LogItemMove(user_id=user.id, item_id=item_id))
        return True, fields

    async def take_item(self, user: models.User, item_id: UUID) -> Tuple[bool, list[str]]:
        inner = await self._get_state()

        player = next((p for p in (inner.players or []) if str(p.user.id) == str(user.id)), None)
        if not player or not getattr(player, "character_id", None):
            return False, []

        ch = self._find_character(inner, player.character_id)
        if not ch:
            return False, []

        # предмет должен быть free
        free_item = next((it for it in (inner.items or []) if it.id == item_id), None)
        if not free_item:
            return False, []

        # игрок должен быть в сцене
        cid = str(player.character_id)
        scene = next(
            (
                s for s in (inner.scenes or [])
                if cid in {str(x) for x in (s.character_ids or [])}
            ),
            None,
        )
        if not scene:
            return False, []

        scene.public = self._ensure_scene_elements(scene.public)

        # строго: предмет должен быть в public item_ids
        public_ids = {str(x) for x in (scene.public.item_ids or [])}
        if str(item_id) not in public_ids:
            return False, []

        await self._transfer_item_db(item_id, to_character_id=player.character_id)
        await self.move_out_scene(scene.id, item_id=item_id)

        await self.add_log(scheme.LogItemMove(user_id=user.id, item_id=item_id))
        return True, ["items", "characters", "scenes", "logs"]

    async def create_item(self, user: models.User, scene_id: UUID, item: Any) -> Tuple[bool, list[str]]:
        if hasattr(item, "model_dump"):
            item_data = item.model_dump()
        else:
            item_data = dict(item)

        scenario_id = await self.get_scenario_id()
        created = await with_db(
            lambda db: item_service.upsert_item_from_ws_dict(
                db, scenario_id=scenario_id, item_dict=item_data, is_create=True
            )
        )
        await self.invalidate_entity_cache()
        await self.move_to_scene(scene_id=scene_id, item_id=created.id, private=True)
        return True, ["items", "scenes", "logs"]
    
    async def update_item(self, user: models.User, scene_id: UUID, item: Any) -> Tuple[bool, list[str]]:
        if hasattr(item, "model_dump"):
            item_data = item.model_dump()
        else:
            item_data = dict(item or {})

        if not item_data.get("id"):
            logger.warning("update_item: missing item.id")
            return False, []

        scenario_id = await self.get_scenario_id()
        await with_db(
            lambda db: item_service.upsert_item_from_ws_dict(
                db, scenario_id=scenario_id, item_dict=item_data, is_create=False
            )
        )
        await self.invalidate_entity_cache()
        return True, ["items", "logs", "scenes"]



    async def delete_item_permanently(
        self,
        user: models.User,
        item_id: UUID | str,
    ) -> Tuple[bool, list[str]]:
        inner = await self._get_state()

        # master-only (как у npc); если хочешь разрешить владельцу — скажи
        if not (inner.master and str(inner.master.id) == str(user.id)):
            return False, []

        # normalize id
        item_uuid = UUID(str(item_id)) if not isinstance(item_id, UUID) else item_id

        inner = await self._get_state()
        item, owner_kind, owner_owner_id = self._find_item_anywhere(inner, item_uuid)
        if not item:
            logger.warning(f"delete_item_permanently: item not found: {item_uuid}")
            return False, []

        deleted = await with_db(lambda db: item_service.delete_item(db, item_id=item_uuid))
        if not deleted:
            return False, []

        await self.invalidate_entity_cache()
        await self._remove_item_from_any_scene(item_uuid)

        fields: list[str] = ["scenes", "logs", "items"]
        if owner_kind == "character":
            fields.append("characters")
        elif owner_kind == "npc":
            fields.append("npcs")

        uniq = []
        for f in fields:
            if f not in uniq:
                uniq.append(f)
        return True, uniq
