from __future__ import annotations

from uuid import UUID, uuid4
from typing import Optional, Tuple

from app import models, scheme
from app.logger import logger
# from .factory_manager import FactoryManager
from .audio_manager import AudioManager  # ← импорт


class ExpositionManager(AudioManager):
    """
    Применение SceneExposure к сцене.
    Шаблонные NPC/item клонируются из фабрики — как create_factory_object,
    но без ручного вызова.
    """

    # ── helpers ────────────────────────────────────────────────────────────

    def _find_exposure(
        self,
        inner: scheme.GameSessionInner,
        exposition_id: UUID,
        from_location_id: Optional[UUID],
        from_story_beat: Optional[UUID],
    ) -> Optional[scheme.InnerSceneExposure]:
        if from_location_id:
            loc = next((l for l in (inner.locations or []) if l.id == from_location_id), None)
            if not loc:
                logger.warning("ExpositionManager: location not found: %s", from_location_id)
                return None
            exposure = next((e for e in (getattr(loc, "scene_exposures", None) or []) if e.id == exposition_id), None)
            if exposure:
                return scheme.InnerSceneExposure.model_validate(exposure)

        if from_story_beat:
            beat = next((b for b in (inner.story_beats or []) if b.id == from_story_beat), None)
            if not beat:
                logger.warning("ExpositionManager: story_beat not found: %s", from_story_beat)
                return None
            exposure = next((e for e in (getattr(beat, "scene_exposures", None) or []) if e.id == exposition_id), None)
            if exposure:
                return scheme.InnerSceneExposure.model_validate(exposure)

        logger.warning(
            "ExpositionManager: exposition not found: %s (loc=%s, beat=%s)",
            exposition_id, from_location_id, from_story_beat,
        )
        return None

    def _find_factory_npc(self, inner: scheme.GameSessionInner, object_id: UUID) -> Optional[scheme.InnerNPC]:
        for f in (inner.factories or []):
            for npc in (f.npcs or []):
                if npc.id == object_id:
                    return npc
        return None

    def _find_factory_item(self, inner: scheme.GameSessionInner, object_id: UUID) -> Optional[scheme.InnerFreeGameItem]:
        for f in (inner.factories or []):
            for it in (f.items or []):
                if it.id == object_id:
                    return it
        return None

    def _is_free_item(
        self,
        inner: scheme.GameSessionInner,
        item_id: UUID,
        scene_location_id: Optional[UUID],
    ) -> bool:
        items_by_id = {it.id: it for it in (inner.items or [])}
        item = items_by_id.get(item_id)
        if not item:
            return False

        for ch in (inner.characters or []):
            for it in (getattr(ch, "owned_items", None) or []):
                if getattr(it, "id", None) == item_id:
                    return False

        for npc in (inner.npcs or []):
            for it in (getattr(npc, "owned_items", None) or []):
                if getattr(it, "id", None) == item_id:
                    return False

        item_loc = getattr(item, "location_id", None)
        if item_loc and scene_location_id and item_loc != scene_location_id:
            return False

        return True

    # ── public API ─────────────────────────────────────────────────────────

    async def apply_exposition(
        self,
        user: models.User,
        *,
        scene_id: UUID,
        exposition_id: UUID,
        from_location_id: Optional[UUID] = None,
        from_story_beat: Optional[UUID] = None,
    ) -> Tuple[bool, list[str]]:
        inner = await self.get_inner()

        if not (inner.master and str(inner.master.id) == str(user.id)):
            return False, []

        scene = next((s for s in (inner.scenes or []) if s.id == scene_id), None)
        print(scene)
        if not scene:
            logger.warning("ExpositionManager: scene not found: %s", scene_id)
            return False, []

        exposure = self._find_exposure(inner, exposition_id, from_location_id, from_story_beat)
        if not exposure:
            return False, []
        print(exposure)

        scene.private = self._ensure_scene_elements(scene.private)
        scenes = list(inner.scenes or [])

        existing_npc_ids = set(scene.private.npc_ids or [])
        existing_item_ids = set(scene.private.item_ids or [])

        # локация сцены — NPC из неё не дублируем
        loc_npc_ids: set[UUID] = set()
        if scene.location_id:
            loc = next((l for l in (inner.locations or []) if l.id == scene.location_id), None)
            if loc:
                loc_npc_ids = set(getattr(loc, "npc_ids", None) or [])

        npcs = list(inner.npcs or [])
        items = list(inner.items or [])
        changed_fields: set[str] = {"scenes"}

        # ── 1) обычные NPC ─────────────────────────────────────────────────
        for npc_id in (exposure.npc_ids or []):
            if npc_id in loc_npc_ids or npc_id in existing_npc_ids:
                continue
            scene.private.npc_ids.append(npc_id)
            existing_npc_ids.add(npc_id)

        # ── 2) обычные предметы ────────────────────────────────────────────
        for item_id in (exposure.item_ids or []):
            if not self._is_free_item(inner, item_id, scene.location_id):
                continue
            if item_id not in existing_item_ids:
                scene.private.item_ids.append(item_id)
                existing_item_ids.add(item_id)

        # ── 3) шаблонные NPC — клонируем из фабрики ────────────────────────
        for tmpl_id in (exposure.template_npc_ids or []):
            src = self._find_factory_npc(inner, tmpl_id)
            if not src:
                logger.warning("ExpositionManager: template npc not found in factory: %s", tmpl_id)
                continue

            new_npc = self._clone_npc_from_factory(src)
            print(new_npc)
            npcs.append(new_npc)
            scene.private.npc_ids.append(new_npc.id)
            existing_npc_ids.add(new_npc.id)
            changed_fields.add("npcs")

        # ── 4) шаблонные предметы — клонируем из фабрики ───────────────────
        for tmpl_id in (exposure.template_item_ids or []):
            src = self._find_factory_item(inner, tmpl_id)
            if not src:
                logger.warning("ExpositionManager: template item not found in factory: %s", tmpl_id)
                continue

            new_item = self._clone_item_from_factory(src)
            items.append(new_item)
            scene.private.item_ids.append(new_item.id)
            existing_item_ids.add(new_item.id)
            changed_fields.add("items")

        # ── 5) препятствия — копируем с новым id ───────────────────────────
        obstacles_private = list(scene.private.obstacles or [])
        for ob in (exposure.obstacles or []):
            new_ob = scheme.ObstacleOut.model_validate(ob) if not hasattr(ob, "model_copy") else ob.model_copy(deep=True)
            try:
                new_ob.id = uuid4()
            except Exception:
                pass
            obstacles_private.append(new_ob)

        scene.private.obstacles = obstacles_private


        # ── 6) аудио — добавляем в очередь ────────────────────────────────
        audio_added = await self.apply_exposure_audio(
            inner=inner,
            exposure=exposure,
            from_location_id=from_location_id,
            from_story_beat=from_story_beat,
            scene=scene,
        )
        if audio_added:
            changed_fields.add("audio_queue")

        # ── 7) сохранить всё ───────────────────────────────────────────────
        if "npcs" in changed_fields:
            inner.npcs = npcs

        if "items" in changed_fields:
            inner.items = items

        await self.set_inner(inner)
        await self._recompute_available_actions_for_scene(inner, scene)
        await self._save_scenes(scenes)

        # audio_queue сохранён внутри apply_exposure_audio через inner
        # if audio_added:
        #     await self.set_inner(inner)

        return True, list(changed_fields)
