from __future__ import annotations

from datetime import datetime
from uuid import uuid4, UUID
from typing import Optional, Tuple

from app import models, scheme
from app.logger import logger

from app.plugins.registry_singleton import registry
from plugins.common.types import *
from .data_manager import SessionDataManager



def _index_by_id(xs):
    return {x.id: x for x in (xs or []) if getattr(x, "id", None) is not None}


def _ensure_list(xs):
    return xs if isinstance(xs, list) else []



class SessionSceneManager(SessionDataManager):
    def __init__(self, session_id: UUID | str):
        super().__init__(str(session_id))
        self._rules_factory_cache = None
        self._rules_id_cache = None

    # --- helpers ---
    async def _save_scenes(self, scenes: list[scheme.SceneInner]) -> None:
        await self.set_field("scenes", [s.model_dump(mode="json") for s in scenes])

    async def _save_seen(self, seen_set, *, added: set[UUID] | None = None) -> None:
        if added:
            await self.persist_seen_delta(added)
            return
        if not self.launched_scenario_id:
            await self.set_field("seen", [str(x) for x in seen_set])

    async def _save_polygon_shown(self, poly_set) -> None:
        await self.persist_polygon_shown(set(poly_set))

    def _ensure_scene_elements(self, el):
        return el or scheme.SceneElementsInner(npc_ids=[], item_ids=[], obstacles=[])

    # --- actions ---
    async def scene_from_location(self, location_id: UUID) -> Tuple[bool, list[str]]:
        inner = await self.get_inner()

        loc = next((l for l in (inner.locations or []) if l.id == location_id), None)
        if not loc:
            return False, []

        # mark location seen
        inner.seen.add(location_id)

        # free items on location: только если у free item есть location_id
        item_ids: list[UUID] = []
        for it in (inner.items or []):
            if hasattr(it, "location_id") and it.location_id == location_id:
                item_ids.append(it.id)

        elements_private = scheme.SceneElementsInner(
            npc_ids=list(getattr(loc, "npc_ids", None) or []),
            item_ids=item_ids,
        )
        scenes = list(inner.scenes or [])
        names = [s.name for s in scenes]
        scene_name = ''
        for i in range(1000):
            tmp = f"Сцена {i+1}"
            if tmp not in names:
                scene_name = tmp
                break

        plugin = self._get_rules_factory(inner)
        scene_init_data = plugin.handle("init", "scene", {}, {})

        scene_time = self.inherit_scene_game_time(inner)

        scene = scheme.SceneInner(
            id=uuid4(),
            data=scene_init_data,
            name=scene_name,
            location_id=location_id,
            character_ids=[],
            public=scheme.SceneElementsInner(npc_ids=[], item_ids=[]),
            private=elements_private,
            datetime=scene_time,
            expanded=False,
            in_top_row=True,
        )
        await self._recompute_available_actions_for_scene(inner, scene)

        scenes.append(scene)

        # save
        await self._save_scenes(scenes)
        await self._save_seen(inner.seen, added={location_id})

        return True, ["scenes", "locations"]  # мастеру scenes достаточно; seen не шлешь апдейтом

    async def del_scene(self, scene_id: UUID, slot: str | None = None) -> Tuple[bool, list[str]]:
        inner = await self.get_inner()
        scenes = list(inner.scenes or [])
        scene = next((s for s in scenes if s.id == scene_id), None)
        if not scene:
            return False, []

        # Один объект, два виджета: убираем только тот ряд, из которого удалили.
        if slot == "top" and scene.parent_scene_id is not None and scene.in_top_row:
            scene.in_top_row = False
            scene.expanded = False
            await self._save_scenes(scenes)
            return True, ["scenes"]
        if slot == "subscene" and scene.parent_scene_id is not None and scene.in_top_row:
            scene.parent_scene_id = None
            await self._save_scenes(scenes)
            return True, ["scenes"]

        new_scenes = [s for s in scenes if s.id != scene_id]
        await self._save_scenes(new_scenes)

        new_actions = [a for a in inner.actions if a.scene_id != scene_id]
        serialized_actions = [
            a.model_dump(mode="json") if hasattr(a, "model_dump") else a
            for a in new_actions
        ]
        await self.set_field("actions", serialized_actions)
        return True, ["scenes", "actions"]

    async def set_scene_location(self, scene_id: UUID, location_id: UUID) -> Tuple[bool, list[str]]:
        inner = await self.get_inner()
        scenes = inner.scenes
        scene = next((s for s in scenes if s.id == scene_id), None)
        if not scene:
            return False, []

        loc = next((l for l in (inner.locations or []) if l.id == location_id), None)
        if not loc:
            return False, []

        scene.location_id = location_id
        inner.seen.add(location_id)

        private = self._ensure_scene_elements(scene.private)

        existing_npc_ids = set(private.npc_ids or [])
        existing_item_ids = set(private.item_ids or [])

        for nid in (getattr(loc, "npc_ids", None) or []):
            if nid not in existing_npc_ids:
                private.npc_ids.append(nid)

        for it in (inner.items or []):
            if hasattr(it, "location_id") and it.location_id == location_id:
                if it.id not in existing_item_ids:
                    private.item_ids.append(it.id)

        scene.private = private

        await self._recompute_available_actions_for_scene(inner, scene)

        await self._save_scenes(scenes)
        await self._save_seen(inner.seen, added={location_id})

        return True, ["scenes", "locations"]


    def _child_location_ids(self, parent_loc, locations) -> list[UUID]:
        """Прямые подлокации и цели полигонов карты, без повторов."""
        seen: set[UUID] = set()
        ordered: list[UUID] = []
        parent_id = getattr(parent_loc, "id", None)
        for loc in locations or []:
            if parent_id is not None and getattr(loc, "parent_location_id", None) == parent_id:
                if loc.id not in seen:
                    seen.add(loc.id)
                    ordered.append(loc.id)
        for mo in (getattr(parent_loc, "map_objects", None) or []):
            target_id = getattr(mo, "target_location_id", None)
            if target_id is not None and target_id not in seen:
                seen.add(target_id)
                ordered.append(target_id)
        return ordered

    async def _append_missing_child_scenes(
        self,
        inner,
        scenes: list[scheme.SceneInner],
        parent_scene: scheme.SceneInner,
    ) -> list[scheme.SceneInner]:
        """Дописывает недостающие подсцены. Список scenes меняется на месте."""
        loc_index = {l.id: l for l in (inner.locations or [])}
        parent_loc = loc_index.get(parent_scene.location_id)
        if not parent_loc:
            return []

        existing_child_locs = {
            s.location_id for s in scenes if s.parent_scene_id == parent_scene.id
        }
        plugin = self._get_rules_factory(inner)
        existing_names = {s.name for s in scenes}
        new_scenes: list[scheme.SceneInner] = []

        for child_loc_id in self._child_location_ids(parent_loc, inner.locations):
            if child_loc_id == parent_scene.location_id or child_loc_id in existing_child_locs:
                continue
            child_loc = loc_index.get(child_loc_id)
            if not child_loc:
                continue

            base_name = getattr(child_loc, "name", None) or str(child_loc_id)
            scene_name = base_name
            counter = 2
            while scene_name in existing_names:
                scene_name = f"{base_name} ({counter})"
                counter += 1
            existing_names.add(scene_name)

            scene_init_data = plugin.handle("init", "scene", {}, {})
            child_time = self.inherit_scene_game_time(inner, parent_scene=parent_scene)
            child_scene = scheme.SceneInner(
                id=uuid4(),
                name=scene_name,
                data=scene_init_data,
                location_id=child_loc_id,
                character_ids=[],
                parent_scene_id=parent_scene.id,
                expanded=False,
                in_top_row=False,
                datetime=child_time,
                public=scheme.SceneElementsInner(npc_ids=[], item_ids=[]),
                private=scheme.SceneElementsInner(npc_ids=[], item_ids=[]),
            )
            await self._recompute_available_actions_for_scene(inner, child_scene)
            new_scenes.append(child_scene)
            existing_child_locs.add(child_loc_id)
            inner.seen.add(child_loc_id)

        scenes.extend(new_scenes)
        return new_scenes

    async def sync_subscenes_from_locations(self) -> bool:
        """Для уже существующих сцен дописывает подсцены новых подлокаций."""
        inner = await self.get_inner()
        scenes = list(inner.scenes or [])
        created: list[scheme.SceneInner] = []
        for scene in list(scenes):
            created.extend(await self._append_missing_child_scenes(inner, scenes, scene))
        if not created:
            return False
        await self._save_scenes(scenes)
        await self._save_seen(inner.seen, added={s.location_id for s in created})
        return True

    async def expand_scene(self, scene_id: UUID) -> Tuple[bool, list[str]]:
        inner = await self.get_inner()
        scenes = list(inner.scenes or [])

        scene = next((s for s in scenes if s.id == scene_id), None)
        if not scene:
            return False, []

        changed = False
        # Подсцена раскрывается в верхний ряд тем же объектом, без второй сцены.
        if scene.parent_scene_id is not None and not scene.in_top_row:
            scene.in_top_row = True
            changed = True
        if not scene.expanded:
            scene.expanded = True
            changed = True

        new_scenes = await self._append_missing_child_scenes(inner, scenes, scene)
        if not new_scenes and not changed:
            return False, []

        await self._save_scenes(scenes)
        if new_scenes:
            await self._save_seen(inner.seen, added={s.location_id for s in new_scenes})
        return True, ["scenes"]

    async def collapse_scene(self, scene_id: UUID) -> Tuple[bool, list[str]]:
        """
        Схлопывает прямых детей этой сцены.
        Ребёнок, который виден ещё и в верхнем ряду, только перестаёт быть подсценой.
        Остальные дети удаляются, их NPC и предметы переносятся родителю.
        """
        inner = await self.get_inner()
        scenes = list(inner.scenes or [])

        parent_scene = next((s for s in scenes if s.id == scene_id), None)
        if not parent_scene:
            return False, []

        child_scenes = [s for s in scenes if s.parent_scene_id == scene_id]
        if not child_scenes:
            return False, []

        parent_scene.public = self._ensure_scene_elements(parent_scene.public)
        parent_scene.private = self._ensure_scene_elements(parent_scene.private)

        existing_pub_npc   = set(parent_scene.public.npc_ids or [])
        existing_pub_item  = set(parent_scene.public.item_ids or [])
        existing_priv_npc  = set(parent_scene.private.npc_ids or [])
        existing_priv_item = set(parent_scene.private.item_ids or [])
        existing_ob_ids    = {
            getattr(ob, "id", None)
            for ob in (parent_scene.private.obstacles or [])
        }

        removable = [s for s in child_scenes if not s.in_top_row]
        for child in child_scenes:
            if child.in_top_row:
                child.parent_scene_id = None

        child_ids = {s.id for s in removable}
        parent_scene.expanded = False

        for child in removable:
            child.public  = self._ensure_scene_elements(child.public)
            child.private = self._ensure_scene_elements(child.private)

            # public NPC
            for nid in (child.public.npc_ids or []):
                if nid not in existing_pub_npc:
                    parent_scene.public.npc_ids.append(nid)
                    existing_pub_npc.add(nid)

            # public items
            for iid in (child.public.item_ids or []):
                if iid not in existing_pub_item:
                    parent_scene.public.item_ids.append(iid)
                    existing_pub_item.add(iid)

            # public obstacles
            for ob in (child.public.obstacles or []):
                ob_id = getattr(ob, "id", None)
                if ob_id not in existing_ob_ids:
                    parent_scene.public.obstacles.append(ob)
                    existing_ob_ids.add(ob_id)

            # private NPC
            for nid in (child.private.npc_ids or []):
                if nid not in existing_priv_npc:
                    parent_scene.private.npc_ids.append(nid)
                    existing_priv_npc.add(nid)

            # private items
            for iid in (child.private.item_ids or []):
                if iid not in existing_priv_item:
                    parent_scene.private.item_ids.append(iid)
                    existing_priv_item.add(iid)

            # private obstacles
            for ob in (child.private.obstacles or []):
                ob_id = getattr(ob, "id", None)
                if ob_id not in existing_ob_ids:
                    parent_scene.private.obstacles.append(ob)
                    existing_ob_ids.add(ob_id)

        # убираем дочерние сцены и их actions
        new_scenes = [s for s in scenes if s.id not in child_ids]
        new_actions = [
            a for a in (inner.actions or [])
            if a.scene_id not in child_ids
        ]

        await self._recompute_available_actions_for_scene(inner, parent_scene)
        await self._save_scenes(new_scenes)
        await self.set_field("actions", [
            a.model_dump(mode="json") if hasattr(a, "model_dump") else a
            for a in new_actions
        ])

        return True, ["scenes", "actions"]

    async def move_character_to_scene(self, scene_id: UUID, character_id: UUID) -> Tuple[bool, list[str]]:
        inner = await self.get_inner()
        scenes = list(inner.scenes or [])
        found = False

        for scene in scenes:
            if scene.id == scene_id:
                if character_id not in scene.character_ids:
                    scene.character_ids.append(character_id)
                found = True
            else:
                if character_id in scene.character_ids:
                    scene.character_ids.remove(character_id)
            await self._recompute_available_actions_for_scene(inner, scene)

        if not found:
            return False, []

        await self._save_scenes(scenes)
        # можно считать, что сам факт “персонаж в сцене” не делает его seen — но если хочешь:
        # inner.seen.add(character_id); await self._save_seen(inner.seen)

        return True, ["scenes"]

    async def set_scene_time(self, scene_id: UUID, time: str) -> Tuple[bool, list[str]]:
        inner = await self.get_inner()
        scenes = list(inner.scenes or [])
        scene = next((s for s in scenes if s.id == scene_id), None)
        if not scene:
            return False, []

        try:
            _ = datetime.fromisoformat(time) if time else None
            scene.datetime = time
        except ValueError:
            logger.warning(f"Invalid datetime format: {time!r}")
            return False, []

        await self._recompute_available_actions_for_scene(inner, scene)
        await self._save_scenes(scenes)
        return True, ["scenes"]


    async def move_to_scene(
        self,
        scene_id: UUID,
        npc_id: UUID = None,
        item_id: UUID = None,
        private: bool = True
    ) -> Tuple[bool, list[str]]:
        inner = await self.get_inner()
        scenes = list(inner.scenes or [])
        scene = next((s for s in scenes if s.id == scene_id), None)
        if not scene:
            return False, []

        scene.public = self._ensure_scene_elements(scene.public)
        scene.private = self._ensure_scene_elements(scene.private)

        target = scene.private if private else scene.public
        updated = False

        npc_added = False
        if npc_id is not None and npc_id not in (target.npc_ids or []):
            target.npc_ids.append(npc_id)
            updated = True
            npc_added = True

        if item_id is not None:
            existing = {str(x) for x in (target.item_ids or [])}
            if str(item_id) not in existing:
                target.item_ids = list(target.item_ids or [])
                target.item_ids.append(item_id)
                updated = True

        if not updated:
            return False, []
        
        await self._recompute_available_actions_for_scene(inner, scene)
        await self._save_scenes(scenes)
        if npc_added and npc_id is not None:
            await self._chronicle_npc(scene_id, npc_id, created=False, joined=True)
        return True, ["scenes"]

    async def _chronicle_npc(self, scene_id, npc_id, *, created: bool, joined: bool) -> None:
        from app.services.chronicle import KIND_NPC_CREATED, KIND_SCENE_JOIN, record_line, stamp_from_inner
        from app.services.scenario_entities.common import with_db

        try:
            inner = await self.get_inner()
            scenario_id = await self.get_scenario_id()
            stamp = stamp_from_inner(inner, scene_id)
            if created:
                await with_db(
                    lambda db: record_line(
                        db,
                        scenario_id,
                        kind=KIND_NPC_CREATED,
                        subject_kind="npc",
                        subject_id=npc_id,
                        stamp=stamp,
                        render=True,
                    )
                )
            if joined:
                await with_db(
                    lambda db: record_line(
                        db,
                        scenario_id,
                        kind=KIND_SCENE_JOIN,
                        subject_kind="npc",
                        subject_id=npc_id,
                        stamp=stamp,
                        render=True,
                    )
                )
        except Exception:
            logger.exception("chronicle npc scene=%s npc=%s", scene_id, npc_id)

    async def move_out_scene(
        self,
        scene_id: UUID,
        npc_id: Optional[UUID] = None,
        item_id: Optional[UUID] = None,
        obstacle_id: Optional[UUID] = None,
    ) -> Tuple[bool, list[str]]:
        inner = await self.get_inner()
        scenes = list(inner.scenes or [])
        scene = next((s for s in scenes if s.id == scene_id), None)
        if not scene:
            return False, []

        scene.public = self._ensure_scene_elements(scene.public)
        scene.private = self._ensure_scene_elements(scene.private)

        updated = False
        item_key = str(item_id) if item_id is not None else None
        npc_key = str(npc_id) if npc_id is not None else None

        for part in (scene.public, scene.private):
            if npc_key is not None and part.npc_ids:
                before = list(part.npc_ids or [])
                part.npc_ids = [x for x in before if str(x) != npc_key]
                if len(part.npc_ids) != len(before):
                    updated = True

            if item_key is not None and part.item_ids:
                before = list(part.item_ids or [])
                part.item_ids = [x for x in before if str(x) != item_key]
                if len(part.item_ids) != len(before):
                    updated = True

            # препятствия – список моделей; фильтруем по id
            if obstacle_id is not None and getattr(part, "obstacles", None):
                before = len(part.obstacles)
                part.obstacles = [
                    ob for ob in part.obstacles
                    if getattr(ob, "id", None) != obstacle_id
                ]
                if len(part.obstacles) != before:
                    updated = True

        if not updated:
            return False, []

        await self._recompute_available_actions_for_scene(inner, scene)
        await self._save_scenes(scenes)
        return True, ["scenes"]


    async def make_element_public(
        self,
        scene_id: UUID,
        public: bool,
        npc_id: Optional[UUID] = None,
        item_id: Optional[UUID] = None,
        obstacle_id: Optional[UUID] = None,
    ) -> Tuple[bool, list[str]]:
        inner = await self.get_inner()
        scenes = list(inner.scenes or [])
        scene = next((s for s in scenes if s.id == scene_id), None)
        if not scene:
            return False, []

        scene.public = self._ensure_scene_elements(scene.public)
        scene.private = self._ensure_scene_elements(scene.private)

        src = scene.private if public else scene.public
        dst = scene.public if public else scene.private

        updated = False
        seen_added: set[UUID] = set()

        def _place_id(ids_attr: str, entity_id: UUID) -> bool:
            """Move from src→dst if present; otherwise add to dst (catalog drop)."""
            nonlocal updated
            src_ids = list(getattr(src, ids_attr) or [])
            dst_ids = list(getattr(dst, ids_attr) or [])
            if entity_id in src_ids:
                src_ids = [x for x in src_ids if x != entity_id]
                if entity_id not in dst_ids:
                    dst_ids.append(entity_id)
                setattr(src, ids_attr, src_ids)
                setattr(dst, ids_attr, dst_ids)
                updated = True
                return True
            if entity_id not in dst_ids:
                dst_ids.append(entity_id)
                setattr(dst, ids_attr, dst_ids)
                updated = True
                return True
            return False

        if npc_id is not None and _place_id("npc_ids", npc_id):
            # Public placement (or move into public) marks the entity as seen by players.
            if public:
                inner.seen.add(npc_id)
                seen_added.add(npc_id)

        if item_id is not None and _place_id("item_ids", item_id):
            if public:
                inner.seen.add(item_id)
                seen_added.add(item_id)

        # препятствия: переносим сам объект по id (между public/private)
        if obstacle_id is not None and getattr(src, "obstacles", None):
            for idx, ob in enumerate(src.obstacles):
                if getattr(ob, "id", None) == obstacle_id:
                    obstacle_obj = src.obstacles.pop(idx)
                    dst_obstacles = getattr(dst, "obstacles", None) or []
                    dst_obstacles.append(obstacle_obj)
                    dst.obstacles = dst_obstacles
                    updated = True
                    break

        if not updated:
            return False, []

        await self._recompute_available_actions_for_scene(inner, scene)
        await self._save_scenes(scenes)
        if seen_added:
            await self._save_seen(inner.seen, added=seen_added)

        return True, ["scenes", "npcs", "items"]



    async def update_scene_data(self, scene_id: UUID, data: dict) -> Tuple[bool, list[str]]:
        """
        Обновляет scene.data и пересчитывает available_actions_by_role для этой сцены.
        Возвращает (ok, fields_to_broadcast).
        """
        inner = await self.get_inner()
        scenes = list(inner.scenes or [])
        scene = next((s for s in scenes if s.id == scene_id), None)
        if not scene:
            return False, []

        # Нормализация: в redis/json пусть едет только json-совместимое
        # (если data вдруг pydantic-модель)
        if hasattr(data, "model_dump"):
            data = data.model_dump(mode="json")  # type: ignore[assignment]
        elif hasattr(data, "dict"):
            data = data.dict()  # type: ignore[assignment]

        if not isinstance(data, dict):
            return False, []

        scene.data = data

        await self._recompute_available_actions_for_scene(inner, scene)
        await self._save_scenes(scenes)

        # мастеру достаточно обновить scenes
        return True, ["scenes"]



    def _build_scene_for_plugin(self, inner: scheme.GameSessionInner, scene: scheme.SceneInner) -> scheme.SceneContext:
        # indexes
        loc_index = _index_by_id(getattr(inner, "locations", None))
        ch_index = _index_by_id(inner.characters)
        npc_index = _index_by_id(getattr(inner, "npcs", None))
        item_index = _index_by_id(getattr(inner, "items", None))

        # location (обязателен для scheme.Scene)
        loc = loc_index.get(scene.location_id)
        if not loc:
            # если локация исчезла — создаём заглушку, но лучше логировать
            loc = scheme.Location(id=scene.location_id, name="(unknown)", description=None)  # подстрой под твой Location
            # если Location требует другие поля — сделай минимальный валидный конструктор

        # TODO предметы в нпс
        # characters: ids -> objects
        characters = []
        for cid in _ensure_list(scene.character_ids):
            ch = ch_index.get(cid)
            if ch:
                ch: scheme.InnerCharacter
                character = ch.model_dump(mode="json")
                character["items"] = [i.model_dump(mode="json") for i in ch.owned_items]
                characters.append(character)

        # public/private: ids -> objects
        pub_ids = scene.public.npc_ids if scene.public else []
        pub_items = scene.public.item_ids if scene.public else []

        npcs=[npc_index[n].model_dump(mode="json") for n in pub_ids if n in npc_index]
        items=[item_index[i].model_dump(mode="json") for i in pub_items if i in item_index]


        location = loc.model_dump(mode="json")
        if "data" not in location:
            location["data"] = {}

        return SceneContext(
            id=scene.id,
            name=scene.name,
            data=scene.data if isinstance(scene.data, dict) else {},
            location=location,
            characters=characters,
            npcs=npcs,
            items=items,
            obstacles=[o.model_dump(mode="json") for o in scene.public.obstacles],
        )

    def _scene_payload_for_plugin(self, inner: scheme.GameSessionInner, scene: scheme.SceneInner) -> ScenePayload:
        sc: SceneContext = self._build_scene_for_plugin(inner, scene)

        players = getattr(inner, "players", None) or []
        # links лучше собирать из players, а не из inner.characters.player
        char_to_user: dict[str, str] = {}
        for p in players:
            cid = getattr(p, "character_id", None)
            user = getattr(p, "user", None)
            uid = getattr(user, "id", None) if user else None
            if cid and uid:
                char_to_user[str(cid)] = str(uid)

        return ScenePayload(
            scene=sc,
            players=[p.model_dump(mode="json") for p in players],
            links=Links(characterToUserId=char_to_user),
        )


    async def _recompute_available_actions_for_scene(self, inner: scheme.GameSessionInner, scene: scheme.SceneInner) -> None:
        # logger.info(f"??? RECOMPUTE {scene.data=}")
        factory = self._get_rules_factory(inner)
        payload_base = self._scene_payload_for_plugin(inner, scene)

        by_role = {}
        for role in ("gm", "player", "initiator"):
            by_role[role] = factory.handle(
                kind="actions.list",
                entity="action",
                payload={**payload_base.model_dump(mode="json"), "role": role},
                context={},
            )

        scene.available_actions_by_role = by_role




    # async def apply_exposition(
    #     self,
    #     user: models.User,
    #     *,
    #     scene_id: UUID,
    #     exposition_id: UUID,
    #     from_location_id: Optional[UUID] = None,
    #     from_story_beat: Optional[UUID] = None,
    # ) -> Tuple[bool, list[str]]:
    #     """
    #     Применяет экспозицию к сцене:
    #     - NPC из экспозиции добавляются в private.npc_ids, если их ещё нет в локации;
    #     - предметы экспозиции добавляются в private.item_ids, если никем не владеют;
    #     - препятствия экспозиции копируются в private (внутри scene.data или отдельного поля).
    #     Всё это кладётся в private-часть сцены.
    #     """
    #     inner = await self.get_inner()

    #     scenes = list(inner.scenes or [])
    #     scene = next((s for s in scenes if s.id == scene_id), None)
    #     if not scene:
    #         logger.warning("apply_exposition: scene not found: %s", scene_id)
    #         return False, []

    #     # master-only, как и остальные scene-операции
    #     if not (inner.master and str(inner.master.id) == str(user.id)):
    #         return False, []

    #     # 1) найти экспозицию
    #     exposure = None

    #     # из локации
    #     if from_location_id:
    #         loc = next((l for l in (inner.locations or []) if l.id == from_location_id), None)
    #         if not loc:
    #             logger.warning("apply_exposition: location not found: %s", from_location_id)
    #             return False, []
    #         exposures = getattr(loc, "scene_exposures", None) or []
    #         exposure = next((e for e in exposures if e.id == exposition_id), None)

    #     # из сюжетного бита
    #     if exposure is None and from_story_beat:
    #         beat = next((b for b in (inner.story_beats or []) if b.id == from_story_beat), None)
    #         if not beat:
    #             logger.warning("apply_exposition: story_beat not found: %s", from_story_beat)
    #             return False, []
    #         exposures = getattr(beat, "scene_exposures", None) or []
    #         exposure = next((e for e in exposures if e.id == exposition_id), None)

    #     if exposure is None:
    #         logger.warning(
    #             "apply_exposition: exposition not found: %s (loc=%s, beat=%s)",
    #             exposition_id,
    #             from_location_id,
    #             from_story_beat,
    #         )
    #         return False, []
    #     exposure = scheme.InnerSceneExposure.model_validate(exposure)

    #     # 2) подготовить private часть сцены
    #     scene.private = self._ensure_scene_elements(scene.private)
    #     private = scene.private

    #     # logger.info(f"{exposure.npc_ids} -> {private.npc_ids=}")
    #     existing_npc_ids = set(private.npc_ids or [])
    #     existing_item_ids = set(private.item_ids or [])

    #     # 3) NPC экспозиции -> private, если ещё не в локации
    #     # предполагаю, что в InnerSceneExposure хранится список npc.id (или целые объекты)
    #     exposure_npc_ids: list[UUID] = []
    #     for npc_id in exposure.npc_ids:
    #         exposure_npc_ids.append(npc_id)

    #     # NPC, уже привязанные к локации (loc.npc_ids), считаем "в локации"
    #     loc_npc_ids = set()
    #     if scene.location_id:
    #         loc = next((l for l in (inner.locations or []) if l.id == scene.location_id), None)
    #         if loc:
    #             loc_npc_ids = set(getattr(loc, "npc_ids", None) or [])

    #     for nid in exposure_npc_ids:
    #         if nid in loc_npc_ids:
    #             # уже в локации, можно не добавлять
    #             continue
    #         if nid not in existing_npc_ids:
    #             private.npc_ids.append(nid)
    #             existing_npc_ids.add(nid)

    #     # 4) предметы экспозиции: только если ими никто не владеет
    #     # предполагаем, что в exposure.items лежат InnerFreeGameItem (id/location_id/...),
    #     # и фактические экземпляры уже есть в inner.items
    #     items_by_id = {it.id: it for it in inner.items}

    #     def _is_free_item(inner: scheme.GameSessionInner, item_id: UUID) -> bool:
    #         """
    #         "Никто не владеет":
    #         - item.id есть в inner.items,
    #         - нет в owned_items персонажей/нпс,
    #         - не привязан к другой локации (или привязан к локации сцены).
    #         """
    #         item = items_by_id.get(item_id)
    #         if not item:
    #             return False

    #         # у персонажей
    #         for ch in inner.characters or []:
    #             for it in getattr(ch, "owned_items", None) or getattr(ch, "owneditems", None) or []:
    #                 if getattr(it, "id", None) == item_id:
    #                     return False

    #         # у нпс
    #         for npc in inner.npcs or []:
    #             for it in getattr(npc, "owned_items", None) or getattr(npc, "owneditems", None) or []:
    #                 if getattr(it, "id", None) == item_id:
    #                     return False

    #         # локация: если у айтема есть location_id и она не совпадает с scene.location_id — не трогаем
    #         item_loc = getattr(item, "location_id", None)
    #         if item_loc and scene.location_id and item_loc != scene.location_id:
    #             return False

    #         return True

    #     for iid in exposure.item_ids:
    #         if not _is_free_item(inner, iid):
    #             continue
    #         if iid not in existing_item_ids:
    #             private.item_ids.append(iid)
    #             existing_item_ids.add(iid)

    #     # 5) препятствия: делаем копию и кладём в private‑часть сцены
    #     # нужно решить, где хранить препятствия сцены.
    #     # Допустим, в scene.data["obstacles_private"] : list[ObstacleOut]
    #     exposure_obstacles = getattr(exposure, "obstacles", None) or []
    #     if exposure_obstacles:
    #         obstacles_private = list(scene.private.obstacles or [])
    #         for ob in exposure_obstacles:
    #             # ob уже ObstacleOut (или совместимая модель)
    #             if hasattr(ob, "model_copy"):
    #                 new_ob = ob.model_copy(deep=True)
    #             else:
    #                 new_ob = scheme.ObstacleOut.model_validate(ob)

    #             # новый id
    #             try:
    #                 new_ob.id = uuid4()
    #             except Exception:
    #                 pass

    #             obstacles_private.append(new_ob)

    #         scene.private.obstacles = obstacles_private

    #     # 6) пересчитать available_actions и сохранить
    #     await self._recompute_available_actions_for_scene(inner, scene)
    #     await self._save_scenes(scenes)

    #     return True, ["scenes"]

