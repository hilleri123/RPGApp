"""Master: synchronized entity presentation to scene + observers."""

from __future__ import annotations

from uuid import UUID, uuid4

from app import models, scheme
from app.infrastructure.database import AsyncSessionLocal
from app.logger import logger
from app.scheme.seen import SeenDataAccess
from app.scheme.session.presentation import PresentedEntityView

from .data_manager import SessionDataManager


class PresentationManager(SessionDataManager):
    def _user_in_scene(
        self,
        inner: scheme.GameSessionInner,
        user_id: UUID,
        scene_id: UUID,
    ) -> bool:
        scene = next((s for s in (inner.scenes or []) if str(s.id) == str(scene_id)), None)
        if not scene:
            return False
        for player in inner.players or []:
            if str(getattr(getattr(player, "user", None), "id", None)) != str(user_id):
                continue
            char_id = getattr(player, "character_id", None)
            if char_id and char_id in (scene.character_ids or []):
                return True
        return False

    def _presented_entity_for_user(
        self,
        inner: scheme.GameSessionInner,
        user_id: UUID,
        *,
        is_master: bool = False,
    ) -> PresentedEntityView | None:
        pe = getattr(inner, "presented_entity", None)
        if not pe:
            return None
        if is_master or self._user_in_scene(inner, user_id, pe.scene_id):
            return pe
        return None

    def _presented_entity_for_observer(
        self,
        inner: scheme.GameSessionInner,
        obs: scheme.Observer | None,
    ) -> PresentedEntityView | None:
        pe = getattr(inner, "presented_entity", None)
        if not pe or obs is None:
            return None
        if obs.scene_id and str(obs.scene_id) == str(pe.scene_id):
            return pe
        return None

    def _resolve_entity_dict(
        self,
        inner: scheme.GameSessionInner,
        entity_type: str,
        entity_id: UUID,
        data_access: SeenDataAccess,
    ) -> dict | None:
        entity_id = UUID(str(entity_id))

        if entity_type == "npc":
            obj = next((x for x in (inner.npcs or []) if x.id == entity_id), None)
        elif entity_type == "game_item":
            obj = next((x for x in (inner.items or []) if x.id == entity_id), None)
        elif entity_type == "player_character":
            obj = next((x for x in (inner.characters or []) if x.id == entity_id), None)
        elif entity_type == "location":
            obj = next((x for x in (inner.locations or []) if x.id == entity_id), None)
        else:
            logger.warning("present_entity: unknown entity_type=%s", entity_type)
            return None

        if obj is None:
            return None

        data = obj.model_dump(mode="json")
        if data_access != SeenDataAccess.FULL and "data" in data:
            data["data"] = {}
        return data

    def _entity_is_public_in_scene(
        self,
        scene: scheme.SceneInner,
        entity_type: str,
        entity_id: UUID,
    ) -> bool:
        entity_id = UUID(str(entity_id))
        public = scene.public

        if entity_type == "npc":
            return entity_id in (public.npc_ids or [])
        if entity_type == "game_item":
            return entity_id in (public.item_ids or [])
        if entity_type == "player_character":
            return entity_id in (scene.character_ids or [])

        return False

    async def present_entity(
        self,
        user: models.User,
        *,
        scene_id: UUID,
        entity_type: str,
        entity_id: UUID,
        data_access: SeenDataAccess = SeenDataAccess.NONE,
    ) -> tuple[bool, list[str]]:
        inner = await self.get_inner()
        if not (inner.master and str(inner.master.id) == str(user.id)):
            return False, []

        scene = next((s for s in (inner.scenes or []) if str(s.id) == str(scene_id)), None)
        if not scene:
            return False, []

        if not self._entity_is_public_in_scene(scene, entity_type, entity_id):
            return False, []

        entity_dict = self._resolve_entity_dict(inner, entity_type, entity_id, data_access)
        if not entity_dict:
            return False, []

        runtime = await self.get_runtime()
        runtime.presented_entity = PresentedEntityView(
            presentation_id=uuid4(),
            scene_id=scene_id,
            entity_type=entity_type,  # type: ignore[arg-type]
            entity=entity_dict,
            data_access=data_access,
        )
        await self.set_runtime(runtime)
        return True, ["presented_entity"]

    async def _set_entity_data_access_for_players(
        self,
        user: models.User,
        *,
        scene_id: UUID,
        entity_type: str,
        entity_id: UUID,
        data_access: SeenDataAccess,
    ) -> tuple[bool, list[str]]:
        inner = await self.get_inner()
        if not (inner.master and str(inner.master.id) == str(user.id)):
            return False, []

        scene = next((s for s in (inner.scenes or []) if str(s.id) == str(scene_id)), None)
        if not scene:
            return False, []

        if not self._entity_is_public_in_scene(scene, entity_type, entity_id):
            return False, []

        from app.services.entity_seen import resolve_seen_entry_from_inner

        entry = resolve_seen_entry_from_inner(inner, UUID(str(entity_id)))
        if entry is None:
            return False, []

        canonical_type, canonical_id = entry
        if not self.launched_scenario_id:
            return False, []

        player_ids = [
            p.user.id
            for p in (inner.players or [])
            if getattr(getattr(p, "user", None), "id", None) is not None
        ]

        if player_ids:
            async with AsyncSessionLocal() as db:
                if data_access == SeenDataAccess.FULL:
                    from app.services.player_seen_service import grant_entity_data_access as grant_fn

                    await grant_fn(
                        db,
                        launched_scenario_id=UUID(str(self.launched_scenario_id)),
                        user_ids=player_ids,
                        entity_type=canonical_type,
                        entity_id=canonical_id,
                    )
                else:
                    from app.services.player_seen_service import revoke_entity_data_access as revoke_fn

                    await revoke_fn(
                        db,
                        launched_scenario_id=UUID(str(self.launched_scenario_id)),
                        user_ids=player_ids,
                        entity_type=canonical_type,
                        entity_id=canonical_id,
                    )
                await db.commit()

        return True, [
            "data_revealed_entities",
            "player_seen",
            "npcs",
            "items",
            "scenes",
        ]

    async def grant_entity_data_access(
        self,
        user: models.User,
        *,
        scene_id: UUID,
        entity_type: str,
        entity_id: UUID,
    ) -> tuple[bool, list[str]]:
        return await self._set_entity_data_access_for_players(
            user,
            scene_id=scene_id,
            entity_type=entity_type,
            entity_id=entity_id,
            data_access=SeenDataAccess.FULL,
        )

    async def revoke_entity_data_access(
        self,
        user: models.User,
        *,
        scene_id: UUID,
        entity_type: str,
        entity_id: UUID,
    ) -> tuple[bool, list[str]]:
        return await self._set_entity_data_access_for_players(
            user,
            scene_id=scene_id,
            entity_type=entity_type,
            entity_id=entity_id,
            data_access=SeenDataAccess.NONE,
        )

    async def dismiss_presented_entity(self, user: models.User) -> tuple[bool, list[str]]:
        inner = await self.get_inner()
        if not (inner.master and str(inner.master.id) == str(user.id)):
            return False, []

        runtime = await self.get_runtime()
        if runtime.presented_entity is None:
            return True, ["presented_entity"]

        runtime.presented_entity = None
        await self.set_runtime(runtime)
        return True, ["presented_entity"]
