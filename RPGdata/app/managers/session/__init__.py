from __future__ import annotations

from typing import Any, Optional, Tuple
import uuid
from datetime import datetime, timezone
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database import get_async_session as get_db
from app.infrastructure.redis_service import redis_client

from .action_manager import SessionActionManager, _dump_json

from .data_manager import SESSION_KEY_PREFIX, SessionDataManager
from .item_manager import SessionItemManager
from .location_manager import SessionLocationManager
from .npc_manager import SessionNPCManager
from .scene_manager import SessionSceneManager
from .user_manager import SessionUserManager
from .character_manager import SessionCharacterManager
from .player_manager import SessionPlayerManager
from .notification_manager import SessionNotificationManager
from .note_manager import SessionNoteManager
from .observer_manager import SessionObserverManager
from .settings_manager import SessionSettingsManager
from .factory_manager import FactoryManager
from .obstacle_manager import SessionObstacleManager
from .exposition_manager import ExpositionManager
from .audio_manager import AudioManager 
from .todo_manager import SessionTODOManager
from .presentation_manager import PresentationManager
from .timeline_manager import SessionTimelineManager


from app.plugins.registry_singleton import registry

from app.services.entity_visibility import (
    entity_visible_for_party,
    filter_entities_for_master,
    filter_entities_for_party,
)

from app import scheme, models
from app.logger import logger
from app.scheme.seen import SeenDataAccess
from app.services.entity_seen import canonical_seen_id



MASTER_ALWAYS_FIELDS = {
    "locations", "notes", "counters", "items", "characters", "npcs", "scenes", "notifications", "logs", "actions", "observers", "players", "polygon_shown", "settings", "audio", "audio_queue", "dispatches", "message_replies", "timeline", "presented_entity", "data_revealed_entities",
}
MASTER_INIT_ONLY_FIELDS = {"story_beats", "factories"}

PLAYER_ALWAYS_FIELDS = {"locations", "characters", "scenes", "notifications", "logs", "polygon_shown", "actions", "settings", "audio_queue", "npcs", "items", "dispatches", "notes", "message_replies", "presented_entity", "self_player", "players", "player_seen"}

# Сущности встроены в другие payload'ы: сцены содержат персонажей, NPC и предметы,
# игрок видит своего персонажа ещё и в self_player. Поэтому правка сущности должна
# обновлять и всё, куда она вложена, — иначе у остальных клиентов остаётся старая копия.
DEPENDENT_UPDATE_FIELDS = {
    "characters": ("scenes", "players", "self_player"),
    "npcs": ("scenes",),
    "items": ("scenes", "characters"),
    "locations": ("scenes",),
}


def expand_dependent_fields(fields: list[str]) -> list[str]:
    """Дополняет список обновляемых полей теми, куда вложены изменённые сущности."""
    out = list(dict.fromkeys(fields or []))
    for f in list(out):
        for dep in DEPENDENT_UPDATE_FIELDS.get(f, ()):
            if dep not in out:
                out.append(dep)
    return out


OBSERVER_ALWAYS_FIELDS = {"locations", "scenes", "observers", "players", "polygon_shown", "characters", "settings", "audio_queue", "presented_entity"}




class CurrentSessionManager(
    PresentationManager,
    ExpositionManager,
    AudioManager,
    FactoryManager,
    SessionSettingsManager,
    SessionObserverManager,
    SessionNoteManager,
    SessionNotificationManager,   # зависит от User
    SessionObstacleManager,
    SessionItemManager,           # зависит от Scene
    SessionLocationManager,       # зависит от Data
    SessionNPCManager,            # зависит от Scene/User
    SessionPlayerManager,         # extends SessionCharacterManager
    SessionActionManager,
    SessionSceneManager,          # зависит от Data
    SessionTODOManager,
    SessionTimelineManager,
    SessionUserManager,           # зависит от Data
    SessionDataManager,           # корень (можно не указывать, подтянется)
):
    def __init__(self, session_id: uuid.UUID, launched_scenario_id: str | None = None):
        super().__init__(str(session_id))
        self.launched_scenario_id = launched_scenario_id


    def _filter_fields_for_master(self, fields: list[str]) -> list[str]:
        # мастер не должен получать init-only в апдейтах
        return [f for f in fields if f in MASTER_ALWAYS_FIELDS]

    def _filter_fields_for_player(self, fields: list[str]) -> list[str]:
        return [f for f in fields if f in PLAYER_ALWAYS_FIELDS]

    def _filter_fields_for_observer(self, fields: list[str]) -> list[str]:
        return [f for f in fields if f in OBSERVER_ALWAYS_FIELDS]

    def _append_player_seen_field(self, fields: list[str], msg: scheme.PlayerSessionUpdate) -> list[str]:
        if msg.player_seen is not None and "player_seen" not in fields:
            return [*fields, "player_seen"]
        return fields


    def _build_timeline(
        self,
        inner: scheme.GameSessionInner,
        current_user_id: Optional[UUID] = None
    ) -> scheme.SessionTimeline:
        return scheme.SessionTimeline(
            **inner.timeline.model_dump()
            )

    def _build_scene_objects(
        self,
        inner: scheme.GameSessionInner,
        current_user_id: Optional[UUID] = None,
        observer_scene_id: Optional[UUID] = None,
        access_map: dict[tuple[str, UUID], SeenDataAccess] | None = None,
    ) -> list[scheme.Scene]:
        loc_by_id   = {l.id: l for l in (inner.locations  or [])}
        ch_by_id    = {c.id: c for c in (inner.characters  or [])}
        npc_by_id   = {n.id: n for n in (inner.npcs        or [])}
        # Scene item_ids may reference free items OR (briefly) still-owned ones.
        # Resolve from free pool + inventories so drops always appear on the scene.
        item_by_id: dict = {i.id: i for i in (inner.items or [])}
        for ch in (inner.characters or []):
            for it in getattr(ch, "owned_items", None) or []:
                iid = getattr(it, "id", None)
                if iid is not None and iid not in item_by_id:
                    item_by_id[iid] = it
        for npc in (inner.npcs or []):
            for it in getattr(npc, "owned_items", None) or []:
                iid = getattr(it, "id", None)
                if iid is not None and iid not in item_by_id:
                    item_by_id[iid] = it
        master_id   = inner.master.id if inner.master else None
        role        = "gm" if current_user_id == master_id else "player"

        own_character_id: UUID | None = None
        if role == "player" and current_user_id and access_map is not None:
            for p in inner.players or []:
                if str(getattr(getattr(p, "user", None), "id", None)) == str(current_user_id):
                    own_character_id = getattr(p, "character_id", None)
                    break

        def _filter(lst, is_public=True):
            if role == "gm":
                return lst
            if not is_public:
                return []
            return [
                i for i in lst
                if not (hasattr(i, "tags") and isinstance(i.tags, list) and "hidden" in i.tags)
            ]

        def _strip_for_player(entity, entity_type: str):
            if role == "gm" or access_map is None:
                return entity
            return self._strip_entity_data_for_player(entity, entity_type, access_map)

        def _build_elements(elems, is_public=True) -> scheme.SceneElements:
            npcs = _filter(
                [npc_by_id[nid] for nid in elems.npc_ids if nid in npc_by_id],
                is_public,
            )
            # Match item ids by str — Redis/json may round-trip UUID vs str.
            items_resolved = []
            for iid in elems.item_ids or []:
                it = item_by_id.get(iid)
                if it is None:
                    it = next((v for k, v in item_by_id.items() if str(k) == str(iid)), None)
                if it is not None:
                    items_resolved.append(it)
            items = _filter(items_resolved, is_public)
            if role == "player" and access_map is not None:
                npcs = [_strip_for_player(n, "npc") for n in npcs]
                items = [_strip_for_player(i, "game_item") for i in items]
            return scheme.SceneElements(
                npcs=npcs,
                items=items,
                obstacles=_filter(elems.obstacles, is_public),
            )

        scenes_out: list[scheme.Scene] = []

        for si in (inner.scenes or []):
            loc = loc_by_id.get(si.location_id)
            if loc is None and si.location_id:
                logger.warning(
                    "Scene %s references missing location %s (session=%s)",
                    si.id,
                    si.location_id,
                    self.session_id,
                )

            scene_characters = [ch_by_id[cid] for cid in si.character_ids if cid in ch_by_id]
            if role == "player" and access_map is not None:
                scene_characters = [
                    self._character_payload(
                        ch,
                        full_data=(own_character_id is not None and ch.id == own_character_id),
                        access_map=access_map,
                    )
                    for ch in scene_characters
                ]

            scene = scheme.Scene(
                **si.model_dump(
                    exclude={
                        "location_id",
                        "character_ids",
                        "public",
                        "private",
                        "available_actions_by_role",
                    }
                ),
                location=loc,
                characters=scene_characters,
                public=_build_elements(si.public, is_public=True),
                private=_build_elements(si.private, is_public=False),
                available_actions=si.available_actions_by_role[role],
            )

            add_scene = role == "gm" or inner.settings.merge_scenes_for_players or scene.id == observer_scene_id
            if not add_scene:
                for p in (inner.players or []):
                    if p.user.id == current_user_id and p.character_id in si.character_ids:
                        add_scene = True
                        break

            if add_scene:
                scenes_out.append(scene)

        return scenes_out
    
    def _build_scene_payload_for_action(
        self,
        inner: scheme.GameSessionInner,
        action: scheme.ActionRecord,   # или ActionRecord
    ) -> dict[str, Any]:
        # action.sceneRef.sceneId — UUID
        return self._build_scene_payload_for_plugin(inner, scene_id=action.scene_id)


    def _action_visible_for_user(self, action: scheme.ActionRecord, current_user_id: UUID) -> bool:
        # if action.status == "completed":
        #     return True

        ids = list(action.participantIds or [])

        # Политика: пустой participantIds => видно всем (чтобы не “пропадали” экшены из-за старых данных)
        if len(ids) == 0:
            return True

        return current_user_id in ids

    
    def _enrich_actions_for_user(
        self,
        inner: scheme.GameSessionInner,
        current_user_id: UUID,
    ) -> list[dict[str, Any]]:
        current_uid = current_user_id if current_user_id is not None else None

        actions: list[scheme.ActionRecord] = self._list_actions(inner)  # <-- уже модельно

        out: list[dict[str, Any]] = []
        for action in actions:
            if action.status != "active" and action.status != "completed":
                continue
            # фильтрация по participantIds (модельно)
            if not inner.settings.show_action_to_everyone or (action.tags and "hidden" in action.tags):
                if current_uid is None or not self._action_visible_for_user(action, current_uid):
                    continue

            # сцена для action (лучше тоже модель/JSON)
            scene_payload = self._build_scene_payload_for_action(inner, action)
            # scene_payload может быть моделью или dict — ниже нормализуем

            action_dict = action.model_dump(mode="json")  # UUID -> str для клиента [web:228]
            action_dict["scene"] = _dump_json(scene_payload)
            out.append(action_dict)

        return out
    

    def _enrich_scene_exposure(self, ex: scheme.InnerSceneExposure, inner: scheme.GameSessionInner) -> scheme.SceneExposureOut:
        tmp = scheme.SceneExposureOut.model_validate(ex.model_dump())

        for npc_id in ex.npc_ids:
            npc = next((i for i in inner.npcs if i.id == npc_id), None)
            if npc:
                tmp.npcs.append(npc)

        for item_id in ex.item_ids:
            item = next((i for i in inner.items if i.id == item_id), None)
            if item:
                tmp.items.append(item)

        # template_npc_ids теперь список {id, qty}
        for link in ex.template_npc_ids:
            npc_id = link.id if hasattr(link, 'id') else link
            qty    = link.qty if hasattr(link, 'qty') else 1
            for factory in inner.factories:
                npc = next((i for i in factory.npcs if i.id == npc_id), None)
                if npc:
                    tmp.template_npc_links.append(
                        scheme.TemplateNPCLinkOut(template_npc=npc, qty=qty)
                    )
                    break

        # template_item_ids теперь список {id, qty}
        for link in ex.template_item_ids:
            item_id = link.id if hasattr(link, 'id') else link
            qty     = link.qty if hasattr(link, 'qty') else 1
            for factory in inner.factories:
                item = next((i for i in factory.items if i.id == item_id), None)
                if item:
                    tmp.template_item_links.append(
                        scheme.TemplateItemLinkOut(template_item=item, qty=qty)
                    )
                    break

        # audio_tracks из audio_links + глобального audio
        audio_by_id = {str(t.id): t for t in (inner.audio or [])}
        tmp.audio_tracks = []
        for audio_link in (ex.audio_links or []):
            track = audio_by_id.get(str(audio_link.audio_track_id))
            tmp.audio_tracks.append(scheme.ExposureAudioLinkOut(
                **audio_link.model_dump(),
                audio_track=track,
            ))

        return tmp

    def _enrich_location(self, loc: scheme.InnerLocation, inner: scheme.GameSessionInner) -> scheme.LocationOut:
        return scheme.LocationOut.model_validate({
            **loc.model_dump(exclude=["scene_exposures"]),
            "scene_exposures": [self._enrich_scene_exposure(ex, inner) for ex in loc.scene_exposures],
        })

    def _enrich_locations(self, inner: scheme.GameSessionInner) -> list[scheme.LocationOut]:
        return [self._enrich_location(l, inner) for l in (inner.locations or [])]

    def _enrich_story_beat(self, sb: scheme.InnerStroyBeat, inner: scheme.GameSessionInner) -> scheme.StoryBeatOut:
        return scheme.StoryBeatOut.model_validate({
            **sb.model_dump(exclude=["scene_exposures"]),
            "scene_exposures": [self._enrich_scene_exposure(ex, inner) for ex in sb.scene_exposures],
        })

    def _enrich_story_beats(self, inner: scheme.GameSessionInner) -> list[scheme.StoryBeatOut]:
        return [self._enrich_story_beat(b, inner) for b in (inner.story_beats or [])]

    # ── audio helpers ─────────────────────────────────────────────────────────────

    def _playing_audio(
        self,
        inner: scheme.GameSessionInner,
    ) -> list[scheme.AudioQueueEntry]:
        current_id = inner.audio_player.current_entry_id
        if not current_id or not inner.audio_player.playing:
            return []
        entry = next((e for e in inner.audio_queue if e.id == current_id), None)
        return [entry] if entry else []

    def _audio_for_player(
        self,
        inner: scheme.GameSessionInner,
    ) -> list[scheme.AudioQueueEntry]:
        if inner.settings.audio_mode != "local":
            return []
        return self._playing_audio(inner)
    
    def _audio_for_observer(
        self,
        inner: scheme.GameSessionInner,
    ) -> list[scheme.AudioQueueEntry]:
        if inner.settings.audio_mode != "observer":
            return []
        return self._playing_audio(inner)


    def _build_session_meta(self, inner: scheme.GameSessionInner) -> scheme.GameSession:
        return scheme.GameSession(
            id=inner.id,
            scenario_id=inner.scenario_id,
            rule_id_str=inner.rule_id_str,
            name=inner.name,
            created_at=inner.created_at,
            master=inner.master,
            players=inner.players,
            campaign_id=getattr(inner, "campaign_id", None),
            campaign_step_index=getattr(inner, "campaign_step_index", None),
            campaign_name=getattr(inner, "campaign_name", None),
            campaign_total_steps=getattr(inner, "campaign_total_steps", None),
        )

    def _seen_access_map(self, records: list) -> dict[tuple[str, UUID], SeenDataAccess]:
        return {(r.entity_type, r.entity_id): r.data_access for r in (records or [])}

    def _entity_data_access(
        self,
        entity_type: str,
        entity: Any,
        access_map: dict[tuple[str, UUID], SeenDataAccess],
    ) -> SeenDataAccess:
        copied_from = getattr(entity, "copied_from", None)
        canonical = canonical_seen_id(
            entity_type=entity_type,
            entity_id=entity.id,
            copied_from=copied_from,
        )
        return access_map.get((entity_type, canonical), SeenDataAccess.NONE)

    def _strip_entity_data_for_player(
        self,
        entity: Any,
        entity_type: str,
        access_map: dict[tuple[str, UUID], SeenDataAccess],
    ) -> Any:
        """Strip master-only fields (tags except presentation ones; data when access is not FULL)."""
        updates: dict[str, Any] = {"tags": self._player_visible_tags(entity_type, entity)}
        if self._entity_data_access(entity_type, entity, access_map) != SeenDataAccess.FULL:
            updates["data"] = {}
        if hasattr(entity, "model_copy"):
            return entity.model_copy(update=updates)
        if hasattr(entity, "tags"):
            try:
                entity.tags = updates["tags"]
            except Exception:
                pass
        return entity

    # Теги NPC, от которых зависит, как его рисует клиент (цвет/иконка квадрата). Остальные
    # теги — мастерская кухня (секреты, фильтры партии) и игроку не уходят.
    PLAYER_VISIBLE_NPC_TAGS = ("enemy", "dead")

    def _player_visible_tags(self, entity_type: str, entity: Any) -> list[str]:
        if entity_type != "npc":
            return []
        tags = getattr(entity, "tags", None)
        if not isinstance(tags, list):
            return []
        return [t for t in tags if str(t) in self.PLAYER_VISIBLE_NPC_TAGS]

    def _strip_tags_for_player(self, entity: Any) -> Any:
        if hasattr(entity, "model_copy"):
            return entity.model_copy(update={"tags": []})
        return entity

    def _player_payload_npcs(
        self,
        inner: scheme.GameSessionInner,
        current_user_id: uuid.UUID,
        player_seen_ids: set[UUID],
        party_filter_tags: list[str] | None,
        access_map: dict[tuple[str, UUID], SeenDataAccess],
    ) -> list:
        npcs = self._player_seen_npcs(inner, current_user_id, player_seen_ids, party_filter_tags)
        return [self._strip_entity_data_for_player(n, "npc", access_map) for n in npcs]

    def _player_payload_items(
        self,
        inner: scheme.GameSessionInner,
        current_user_id: uuid.UUID,
        player_seen_ids: set[UUID],
        party_filter_tags: list[str] | None,
        access_map: dict[tuple[str, UUID], SeenDataAccess],
    ) -> list:
        items = self._player_seen_items(inner, current_user_id, player_seen_ids, party_filter_tags)
        return [self._strip_entity_data_for_player(i, "game_item", access_map) for i in items]

    def _find_inner_character(self, inner: scheme.GameSessionInner, character_id: Any):
        if not character_id:
            return None
        for ch in inner.characters or []:
            if str(ch.id) == str(character_id):
                return ch
        return None

    def _character_payload(
        self,
        ch: Any,
        *,
        full_data: bool,
        access_map: dict[tuple[str, UUID], SeenDataAccess],
    ) -> Any:
        if full_data:
            return ch.model_dump(mode="json") if hasattr(ch, "model_dump") else ch
        return self._strip_entity_data_for_player(ch, "player_character", access_map)

    def _enrich_player_record(
        self,
        inner: scheme.GameSessionInner,
        player: Any,
        access_map: dict[tuple[str, UUID], SeenDataAccess],
        *,
        full_own_character: bool = False,
    ) -> dict[str, Any]:
        d = player.model_dump(mode="json") if hasattr(player, "model_dump") else dict(player)
        cid = d.get("character_id")
        ch = self._find_inner_character(inner, cid)
        if ch is not None:
            d["character"] = self._character_payload(ch, full_data=full_own_character, access_map=access_map)
            d["character_id"] = ch.id
        return d

    def _build_self_player(
        self,
        inner: scheme.GameSessionInner,
        current_user_id: uuid.UUID,
        access_map: dict[tuple[str, UUID], SeenDataAccess],
    ) -> dict[str, Any] | None:
        player = next((p for p in (inner.players or []) if str(p.user.id) == str(current_user_id)), None)
        if player is None:
            return None
        return self._enrich_player_record(inner, player, access_map, full_own_character=True)

    def _player_payload_players(
        self,
        inner: scheme.GameSessionInner,
        current_user_id: uuid.UUID,
        access_map: dict[tuple[str, UUID], SeenDataAccess],
    ) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        for p in inner.players or []:
            is_self = str(p.user.id) == str(current_user_id)
            if is_self:
                out.append(self._enrich_player_record(inner, p, access_map, full_own_character=True))
            else:
                d = p.model_dump(mode="json") if hasattr(p, "model_dump") else dict(p)
                d["character"] = None
                out.append(d)
        return out

    def _player_payload_characters(
        self,
        inner: scheme.GameSessionInner,
        access_map: dict[tuple[str, UUID], SeenDataAccess],
        current_user_id: uuid.UUID,
    ) -> list:
        player = next((p for p in (inner.players or []) if str(p.user.id) == str(current_user_id)), None)
        if player is None or not player.character_id:
            return []
        ch = self._find_inner_character(inner, player.character_id)
        if ch is None:
            return []
        return [self._character_payload(ch, full_data=True, access_map=access_map)]

    def _seen_ids(self, inner: scheme.GameSessionInner) -> set[str]:
        return {str(x) for x in (inner.seen or [])}

    def _entity_visible_in_set(self, entity: Any, visible: set[str]) -> bool:
        if str(entity.id) in visible:
            return True
        copied_from = getattr(entity, "copied_from", None)
        return bool(copied_from and str(copied_from) in visible)

    def _find_inner_npc(self, inner: scheme.GameSessionInner, entity_id: str):
        for npc in inner.npcs or []:
            if str(npc.id) == entity_id:
                return npc
            if getattr(npc, "copied_from", None) and str(npc.copied_from) == entity_id:
                return npc
        return None

    def _find_inner_item(self, inner: scheme.GameSessionInner, entity_id: str):
        for item in inner.items or []:
            if str(item.id) == entity_id:
                return item
            if getattr(item, "copied_from", None) and str(item.copied_from) == entity_id:
                return item
        return None

    def _player_visible_entity_ids(
        self,
        inner: scheme.GameSessionInner,
        current_user_id: uuid.UUID,
        seen_ids: set[UUID],
        party_filter_tags: list[str] | None = None,
    ) -> set[str]:
        ids = {str(x) for x in seen_ids}
        for si in inner.scenes or []:
            player_in_scene = any(
                str(p.user.id) == str(current_user_id) and p.character_id in (si.character_ids or [])
                for p in (inner.players or [])
            )
            if not player_in_scene:
                continue
            public = getattr(si, "public", None)
            if public:
                for nid in getattr(public, "npc_ids", None) or []:
                    ids.add(str(nid))
                for iid in getattr(public, "item_ids", None) or []:
                    ids.add(str(iid))
        if not party_filter_tags:
            return ids
        filtered: set[str] = set()
        for nid in ids:
            npc = self._find_inner_npc(inner, nid)
            if npc is not None:
                if entity_visible_for_party(getattr(npc, "tags", None), party_filter_tags):
                    filtered.add(nid)
                continue
            item = self._find_inner_item(inner, nid)
            if item is not None:
                if entity_visible_for_party(getattr(item, "tags", None), party_filter_tags):
                    filtered.add(nid)
                continue
            loc = next((l for l in (inner.locations or []) if str(l.id) == nid), None)
            if loc is not None:
                if entity_visible_for_party(getattr(loc, "tags", None), party_filter_tags):
                    filtered.add(nid)
                continue
            filtered.add(nid)
        return filtered

    def _player_seen_npcs(
        self,
        inner: scheme.GameSessionInner,
        current_user_id: uuid.UUID,
        seen_ids: set[UUID],
        party_filter_tags: list[str] | None = None,
    ) -> list:
        visible = self._player_visible_entity_ids(inner, current_user_id, seen_ids, party_filter_tags)
        matched = [n for n in (inner.npcs or []) if self._entity_visible_in_set(n, visible)]
        by_key: dict[str, Any] = {}
        for npc in matched:
            key = str(getattr(npc, "copied_from", None) or npc.id)
            if key not in by_key:
                by_key[key] = npc
        return list(by_key.values())

    def _player_seen_items(
        self,
        inner: scheme.GameSessionInner,
        current_user_id: uuid.UUID,
        seen_ids: set[UUID],
        party_filter_tags: list[str] | None = None,
    ) -> list:
        visible = self._player_visible_entity_ids(inner, current_user_id, seen_ids, party_filter_tags)
        matched = [i for i in (inner.items or []) if self._entity_visible_in_set(i, visible)]
        by_key: dict[str, Any] = {}
        for item in matched:
            key = str(getattr(item, "copied_from", None) or item.id)
            if key not in by_key:
                by_key[key] = item
        return list(by_key.values())

    async def _load_data_revealed_entities(self) -> list:
        if not self.launched_scenario_id:
            return []
        from app.infrastructure.database import AsyncSessionLocal
        from app.services.player_seen_service import get_revealed_data_entities

        async with AsyncSessionLocal() as db:
            return await get_revealed_data_entities(
                db,
                launched_scenario_id=uuid.UUID(str(self.launched_scenario_id)),
            )

    async def build_master_init(self) -> scheme.MasterSessionInit:
        inner = await self.get_inner()
        master_id = inner.master.id if inner.master else None
        scenes_denorm = self._build_scene_objects(inner, master_id)
        master_filter = list(getattr(inner.settings, "master_filter_tags", None) or [])
        data_revealed = await self._load_data_revealed_entities()

        return scheme.MasterSessionInit(
            locations=filter_entities_for_master(self._enrich_locations(inner), master_filter),
            story_beats=self._enrich_story_beats(inner),
            factories=inner.factories,
            notes=filter_entities_for_master(inner.notes or [], master_filter),
            counters=inner.counters,
            items=filter_entities_for_master(inner.items or [], master_filter),
            characters=inner.characters,
            npcs=filter_entities_for_master(inner.npcs or [], master_filter),
            scenes=scenes_denorm,
            notifications=inner.notifications,
            logs=inner.logs,
            players=inner.players,
            observers=inner.observers,
            settings=inner.settings,
            polygon_shown=inner.polygon_shown,
            audio=inner.audio,
            audio_queue=inner.audio_queue or [],
            audio_player=inner.audio_player,
            timeline = self._build_timeline(inner, master_id),
            actions=self._enrich_actions_for_user(inner, master_id),
            dispatches=list(getattr(inner, "dispatches", None) or []),
            message_replies=self._replies_for_user(inner, master_id, is_master=True),
            session=self._build_session_meta(inner),
            presented_entity=inner.presented_entity,
            data_revealed_entities=data_revealed,
        )

    async def build_master_update(self, fields: list[str]) -> scheme.MasterSessionUpdate:
        inner = await self.get_inner()
        msg = scheme.MasterSessionUpdate(fields=fields)
        master_id = inner.master.id if inner.master else None

        # только always-поля
        if "locations" in fields: msg.locations = self._enrich_locations(inner)
        if "polygon_shown" in fields: msg.polygon_shown=inner.polygon_shown
        if "story_beats" in fields: msg.story_beats = self._enrich_story_beats(inner)
        if "actions" in fields: msg.actions = self._enrich_actions_for_user(inner, master_id)
        if "notes" in fields: msg.notes = inner.notes
        if "counters" in fields: msg.counters = inner.counters
        if "items" in fields: msg.items = inner.items
        if "characters" in fields: msg.characters = inner.characters
        if "npcs" in fields: msg.npcs = inner.npcs
        if "scenes" in fields: msg.scenes = self._build_scene_objects(inner, master_id)
        if "observers" in fields: msg.observers = inner.observers
        if "notifications" in fields: msg.notifications = inner.notifications
        if "logs" in fields: msg.logs = inner.logs
        if "settings" in fields: msg.settings = inner.settings
        if "timeline" in fields: msg.timeline = self._build_timeline(inner, master_id)
        if "audio_queue" in fields:
            msg.audio_queue = inner.audio_queue or []
            msg.audio_player=inner.audio_player
        if "dispatches" in fields:
            msg.dispatches = list(getattr(inner, "dispatches", None) or [])
        if "message_replies" in fields:
            msg.message_replies = self._replies_for_user(inner, master_id, is_master=True)
        if "presented_entity" in fields:
            msg.presented_entity = inner.presented_entity
        if "data_revealed_entities" in fields:
            msg.data_revealed_entities = await self._load_data_revealed_entities()
        if "players" in fields:
            msg.players = [
                p.model_dump(mode="json") if hasattr(p, "model_dump") else p
                for p in (inner.players or [])
            ]

        return msg

    async def build_player_init(self, current_user_id: uuid.UUID) -> scheme.PlayerSessionInit:
        inner = await self.get_inner()
        player_seen_ids, player_poly, player_seen_records = await self.get_player_seen_sets(current_user_id)
        access_map = self._seen_access_map(player_seen_records)
        scenes_denorm = self._build_scene_objects(inner, current_user_id, access_map=access_map)
        party_tags = await self.get_party_filter_tags() if self.launched_scenario_id else []

        visible_locations = [
            self._strip_tags_for_player(loc)
            for loc in self._enrich_locations(inner)
            if loc.id in player_seen_ids
            and entity_visible_for_party(getattr(loc, "tags", None), party_tags or None)
        ]

        self_player = self._build_self_player(inner, current_user_id, access_map)

        return scheme.PlayerSessionInit(
            locations=visible_locations,
            characters=self._player_payload_characters(inner, access_map, current_user_id),
            npcs=self._player_payload_npcs(inner, current_user_id, player_seen_ids, party_tags or None, access_map),
            items=self._player_payload_items(inner, current_user_id, player_seen_ids, party_tags or None, access_map),
            scenes=scenes_denorm,
            dispatches=self._dispatches_for_user(inner, current_user_id, is_master=False),
            notes=self._notes_for_user(inner, current_user_id, is_master=False),
            message_replies=self._replies_for_user(inner, current_user_id, is_master=False),
            notifications=self._build_notifications_for_user(inner, current_user_id),
            polygon_shown=player_poly,
            logs=inner.logs,
            players=self._player_payload_players(inner, current_user_id, access_map),
            actions=self._enrich_actions_for_user(inner, current_user_id),
            self_player=self_player,
            session=self._build_session_meta(inner),
            settings=inner.settings,
            audio_queue=self._audio_for_player(inner),
            audio_player=inner.audio_player,
            player_seen=player_seen_records,
            presented_entity=self._presented_entity_for_user(inner, current_user_id),
        )

    async def build_player_update(self, current_user_id: uuid.UUID, fields: list[str]) -> scheme.PlayerSessionUpdate:
        inner = await self.get_inner()
        msg = scheme.PlayerSessionUpdate(fields=fields)
        player_seen_ids, player_poly, player_seen_records = await self.get_player_seen_sets(current_user_id)
        access_map = self._seen_access_map(player_seen_records)
        party_tags = await self.get_party_filter_tags() if self.launched_scenario_id else []

        if "actions" in fields: msg.actions = self._enrich_actions_for_user(inner, current_user_id)
        if "locations" in fields:
            msg.locations = [
                self._strip_tags_for_player(loc)
                for loc in self._enrich_locations(inner)
                if loc.id in player_seen_ids
                and entity_visible_for_party(getattr(loc, "tags", None), party_tags or None)
            ]
            msg.player_seen = player_seen_records
        if "polygon_shown" in fields: msg.polygon_shown = player_poly
        if "characters" in fields:
            msg.characters = self._player_payload_characters(inner, access_map, current_user_id)
            msg.player_seen = player_seen_records
            msg.self_player = self._build_self_player(inner, current_user_id, access_map)
        if "npcs" in fields:
            msg.npcs = self._player_payload_npcs(
                inner, current_user_id, player_seen_ids, party_tags or None, access_map
            )
            msg.player_seen = player_seen_records
        if "items" in fields:
            msg.items = self._player_payload_items(
                inner, current_user_id, player_seen_ids, party_tags or None, access_map
            )
            msg.player_seen = player_seen_records
        if "scenes" in fields:
            msg.scenes = self._build_scene_objects(inner, current_user_id, access_map=access_map)
            msg.npcs = self._player_payload_npcs(
                inner, current_user_id, player_seen_ids, party_tags or None, access_map
            )
            msg.items = self._player_payload_items(
                inner, current_user_id, player_seen_ids, party_tags or None, access_map
            )
            msg.player_seen = player_seen_records
            if "npcs" not in fields:
                fields = [*fields, "npcs"]
            if "items" not in fields:
                fields = [*fields, "items"]
            msg.fields = fields
        if "dispatches" in fields:
            msg.dispatches = self._dispatches_for_user(inner, current_user_id, is_master=False)
        if "notes" in fields:
            msg.notes = self._notes_for_user(inner, current_user_id, is_master=False)
        if "message_replies" in fields:
            msg.message_replies = self._replies_for_user(inner, current_user_id, is_master=False)
        if "notifications" in fields: msg.notifications = self._build_notifications_for_user(inner, current_user_id)
        if "logs" in fields: msg.logs = inner.logs
        if "settings" in fields: msg.settings = inner.settings
        if "audio_queue" in fields:
            msg.audio_queue=self._audio_for_player(inner)
            msg.audio_player=inner.audio_player
        if "players" in fields:
            msg.players = self._player_payload_players(inner, current_user_id, access_map)
        if "self_player" in fields:
            msg.self_player = self._build_self_player(inner, current_user_id, access_map)
        if "presented_entity" in fields:
            msg.presented_entity = self._presented_entity_for_user(inner, current_user_id)
        if "player_seen" in fields and msg.player_seen is None:
            msg.player_seen = player_seen_records

        msg.fields = self._append_player_seen_field(list(msg.fields or fields), msg)

        return msg



    def _find_observer_by_code(self, inner: scheme.GameSessionInner, code: str) -> Optional[scheme.Observer]:
        for o in (inner.observers or []):
            if str(o.code) == str(code):
                return o
        return None
    

    def _pick_observer_location(
        self, 
        inner: scheme.GameSessionInner,
        obs: Optional[scheme.Observer] = None,
    ) -> Optional[scheme.Location]:
        if obs is None:
            return None

        # 1) приоритет: конкретная location_id
        if obs.location_id:
            return next((l for l in (inner.locations or []) if l.id == obs.location_id), None)

        # 2) иначе: сцена -> её локация
        if obs.scene_id:
            scene = next((s for s in (inner.scenes or []) if s.id == obs.scene_id), None)
            if scene and getattr(scene, "location_id", None):
                return next((l for l in (inner.locations or []) if l.id == scene.location_id), None)

        return None
    

    async def get_observer_recipients(self) -> list[scheme.Observer]:
        inner = await self.get_inner()
        return list(inner.observers or [])

    

    async def build_observer_init(self, code: str) -> scheme.ObserverSessionInit:
        inner = await self.get_inner()
        obs = self._find_observer_by_code(inner, code)

        loc = self._pick_observer_location(inner, obs)

        return scheme.ObserverSessionInit(
            code=str(code),
            location=[loc] if loc else [],
            polygon_shown=inner.polygon_shown,
            characters=inner.characters,  # если надо - позже добавишь
            players=inner.players,
            locations = self._enrich_locations(inner),
            scenes = self._build_scene_objects(inner, observer_scene_id=obs.scene_id),
            session=scheme.GameSession(
                id=inner.id,
                scenario_id=inner.scenario_id,
                rule_id_str=inner.rule_id_str,  # <-- ДОБАВИТЬ
                name=inner.name,
                created_at=inner.created_at,
                master=inner.master,
                players=inner.players,
                audio_queue=self._audio_for_observer(inner),
            ),
            presented_entity=self._presented_entity_for_observer(inner, obs),
        )


    async def push_entity_updates(self, connection_manager, fields: list[str]) -> None:
        fields = expand_dependent_fields(list(fields or []))
        if "timeline" in fields:
            await self.refresh_timeline_scenario_start()
        master_fields = self._filter_fields_for_master(fields)
        player_fields = self._filter_fields_for_player(fields)
        if not master_fields and not player_fields:
            return

        members = await self.get_recipients()
        master_msg = None
        master_payload = None
        if master_fields:
            master_msg = await self.build_master_update(master_fields)
            master_payload = master_msg.model_dump(mode="json")

        for member in members:
            try:
                if master_msg is not None and await self.is_master(member):
                    await connection_manager.send_json(member.id, master_payload)
                elif player_fields:
                    player_msg = await self.build_player_update(member.id, player_fields)
                    await connection_manager.send_json(member.id, player_msg.model_dump(mode="json"))
            except Exception as e:
                logger.exception(f"push_entity_updates send failed to user={getattr(member, 'id', None)}: {e}")


    async def build_observer_update(self, code: str, fields: list[str]) -> scheme.ObserverSessionUpdate:
        inner = await self.get_inner()
        fields = self._filter_fields_for_observer(fields)

        obs = self._find_observer_by_code(inner, code)

        msg = scheme.ObserverSessionUpdate(code=str(code), fields=fields)

        # поля, влияющие на то, что именно показываем обсерверам
        affects_view = any(
            f in fields for f in (
                "observers",        # update_observer
                "scenes",           # сцена могла сменить location_id
                "locations",        # локации/полигоны могли обновиться
                "polygon_shown",    # если ты так называешь поле в fields
            )
        )

        if affects_view:
            loc = self._pick_observer_location(inner, obs)
            msg.location = [loc] if loc else []
            msg.locations = self._enrich_locations(inner)
            msg.scenes = self._build_scene_objects(inner, observer_scene_id=obs.scene_id)
            msg.polygon_shown = inner.polygon_shown
            msg.audio_queue=self._audio_for_observer(inner)

        if "presented_entity" in fields:
            msg.presented_entity = self._presented_entity_for_observer(inner, obs)

        return msg
    
    async def finish_session(
        self,
        current_user: models.User,
        *,
        forced: bool,
        close_launched_scenario: bool = False,
    ) -> Tuple[bool, Optional[scheme.CampaignSessionFinishOut]]:
        """
        Завершает сессию:
        - только мастер;
        - в БД: GameSession.is_active=False;
        - Player.finished_with_character_data = итоговый snapshot;
        - для каждого игрока создаёт CharacterApplication как результат сессии;
        - для кампании сохраняет carryover;
        - удаляет snapshot из Redis.
        """
        inner = await self.get_inner()
        campaign_finish: Optional[scheme.CampaignSessionFinishOut] = None
        launched_id: UUID | None = None

        if not (inner.master and str(inner.master.id) == str(current_user.id)):
            logger.warning(
                "finish_session: user is not master: user=%s, master=%s",
                current_user.id,
                getattr(inner.master, "id", None),
            )
            return False, None

        async for db in get_db():
            db: AsyncSession

            gs: models.GameSession | None = await db.get(models.GameSession, inner.id)
            if not gs:
                logger.warning("finish_session: GameSession not found: %s", inner.id)
                return False, None

            rule_id_str = (
                getattr(inner, "rule_id_str", None)
                or getattr(getattr(inner, "scenario", None), "rule_id_str", None)
                or getattr(getattr(gs, "scenario", None), "rule_id_str", None)
            )

            if not gs.is_active:
                # Still release Redis approach binding if a previous finish left it hanging.
                launched_id = gs.launched_scenario_id
                if launched_id:
                    from app.services.launched_scenario_service import release_approach_runtime

                    await release_approach_runtime(launched_id, gs.id)
                else:
                    await redis_client.delete(f"{SESSION_KEY_PREFIX}:{inner.id}")
                return True, None

            stmt = (
                select(models.Player)
                .where(models.Player.game_session_id == gs.id)
                .options(
                    selectinload(models.Player.user),
                )
            )
            res = await db.execute(stmt)
            players: list[models.Player] = list(res.scalars())

            inner_players_by_id = {
                str(p.id): p for p in (inner.players or [])
            }
            inner_chars_by_id = {
                str(c.id): c for c in (inner.characters or [])
            }

            for p in players:
                ch_json = None

                # 1. главный источник истины — актуальный персонаж из inner.characters
                if p.character_id:
                    inner_ch = inner_chars_by_id.get(str(p.character_id))
                    if inner_ch is not None:
                        try:
                            ch_json = (
                                inner_ch.model_dump(mode="json")
                                if hasattr(inner_ch, "model_dump")
                                else dict(inner_ch)
                            )
                        except Exception:
                            logger.exception(
                                "finish_session: cannot dump inner character %s for player %s",
                                p.character_id,
                                p.id,
                            )

                # 2. fallback — если у player внутри уже лежит character
                if ch_json is None:
                    inner_player = inner_players_by_id.get(str(p.id))
                    if inner_player and getattr(inner_player, "character", None):
                        try:
                            ch = inner_player.character
                            ch_json = (
                                ch.model_dump(mode="json")
                                if hasattr(ch, "model_dump")
                                else dict(ch)
                            )
                        except Exception:
                            logger.exception(
                                "finish_session: cannot dump inner player.character for player %s",
                                p.id,
                            )

                # 3. последний fallback — стартовый snapshot
                if ch_json is None and p.character_snapshot:
                    ch_json = p.character_snapshot


                p.finished_with_character_data = ch_json

                if not ch_json or not p.user_id or forced:
                    continue

                if p.character_source_type == "application":
                    continue

                target_app_id = p.character_id

                app = None
                if target_app_id:
                    app = await db.get(models.CharacterApplication, target_app_id)

                history_entry = {
                    "kind": "session_result",
                    "session_id": str(gs.id),
                    "player_id": str(p.id),
                    "session_name": gs.name,
                    "forced": forced,
                }

                if app is None:
                    app = models.CharacterApplication(
                        id=target_app_id or uuid.uuid4(),
                        rule_id_str=rule_id_str,
                        user_id=p.user_id,
                        name=ch_json.get("name") or p.name or "Безымянный персонаж",
                        short_desc=ch_json.get("short_desc"),
                        story=ch_json.get("story"),
                        tags=ch_json.get("tags") or [],
                        data={
                            **(ch_json.get("data") or {}),
                            "_history": [history_entry],
                        },
                        icon_url=ch_json.get("icon_url"),
                        img_url=ch_json.get("img_url"),
                        status=models.ApplicationStatus.approved,
                        source_kind="session_result",
                        source_session_id=gs.id,
                        source_player_id=p.id,
                        is_result_snapshot=True,
                    )
                    db.add(app)
                else:
                    old_data = app.data or {}
                    old_history = old_data.get("_history") or []

                    app.rule_id_str = rule_id_str
                    app.user_id = p.user_id
                    app.name = ch_json.get("name") or p.name or app.name
                    app.short_desc = ch_json.get("short_desc")
                    app.story = ch_json.get("story")
                    app.tags = ch_json.get("tags") or []
                    app.data = {
                        **(ch_json.get("data") or {}),
                        "_history": [*old_history, history_entry],
                    }
                    app.icon_url = ch_json.get("icon_url")
                    app.img_url = ch_json.get("img_url")
                    app.status = models.ApplicationStatus.approved
                    app.source_kind = "session_result"
                    app.source_session_id = gs.id
                    app.source_player_id = p.id
                    app.is_result_snapshot = True


            if gs.campaign_id and not forced:
                from app.services.campaign_service import save_campaign_carryover

                step_idx = gs.campaign_step_index if gs.campaign_step_index is not None else 0
                campaign_finish = await save_campaign_carryover(
                    db,
                    campaign_id=gs.campaign_id,
                    inner=inner,
                    finished_step_index=step_idx,
                    advance_step=True,
                )

            if not forced and gs.scenario_id:
                from app.services.application_entity_service import detach_application_pool_from_scenario

                await detach_application_pool_from_scenario(db, gs.scenario_id)

            gs.is_active = False
            gs.status = (
                models.GameSessionStatus.finished_forced
                if forced
                else models.GameSessionStatus.finished_ok
            )
            gs.finished_at = datetime.now(timezone.utc)
            launched_id = gs.launched_scenario_id
            await db.commit()

        if launched_id:
            if close_launched_scenario:
                from app.services.launched_scenario_service import close_launched_scenario

                async for db in get_db():
                    await close_launched_scenario(db, launched_id)
            else:
                from app.services.launched_scenario_service import release_approach_runtime

                await release_approach_runtime(launched_id, inner.id)
        else:
            await redis_client.delete(f"{SESSION_KEY_PREFIX}:{inner.id}")
        return True, campaign_finish