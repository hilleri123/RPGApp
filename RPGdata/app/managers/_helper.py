# session_builder.py (или прямо в том же файле, отдельным блоком)

from typing import Any, Dict, Iterable, List
from uuid import UUID

from sqlalchemy import UUID as SAUUID
from app import models, scheme
from app.logger import logger

def _pick_one(v):
    if v is None:
        return None
    if isinstance(v, list):
        return v[0] if v else None
    return v


def _as_uuid_set(value) -> set[SAUUID]:
    if not value:
        return set()
    res: set[SAUUID] = set()
    for x in value:
        res.add(x if isinstance(x, SAUUID) else SAUUID(str(x)))
    return res


# ── конвертеры ORM -> dict ──────────────────────────────────────────────────
def _convert_exposure(orm_exposure: models.SceneExposure) -> tuple[dict, list]:
    data = {
        "id": orm_exposure.id,
        "name": orm_exposure.name,
        "tags": orm_exposure.tags or [],
        "order_num": orm_exposure.order_num,
        "location_id": orm_exposure.location_id,
        "story_beat_id": orm_exposure.story_beat_id,
        "npcs": [scheme.NPCList.model_validate(x).model_dump(mode="python") for x in (orm_exposure.npcs or [])],
        "items": [scheme.GameItemWithOwnerShort.model_validate(x).model_dump(mode="python") for x in (orm_exposure.items or [])],
        "template_npcs": [
            scheme.NPCList.model_validate(link.template_npc).model_dump(mode="python")
            for link in (orm_exposure.template_npc_links or [])
            if link.template_npc is not None
            for _ in range(link.qty or 1)
        ],
        "template_items": [
            scheme.GameItemWithOwnerShort.model_validate(link.template_item).model_dump(mode="python")
            for link in (orm_exposure.template_item_links or [])
            if link.template_item is not None
            for _ in range(link.qty or 1)
        ],
        "obstacles": [scheme.ObstacleOut.model_validate(x).model_dump(mode="python") for x in (orm_exposure.obstacles or [])],
        "audio_tracks": [
            scheme.ExposureAudioLinkOut.model_validate(x).model_dump(mode="python")
            for x in (orm_exposure.audio_tracks or [])
        ],
    }

    def extract_ids(items: list) -> list[str]:
        result = []
        for it in (items or []):
            it_id = getattr(it, "id", None) or (it.get("id") if isinstance(it, dict) else None)
            if it_id:
                result.append(str(it_id))
        return result

    data["npc_ids"] = extract_ids(data.pop("npcs", []))
    data["item_ids"] = extract_ids(data.pop("items", []))
    data["template_npc_ids"] = extract_ids(data.pop("template_npcs", []))
    data["template_item_ids"] = extract_ids(data.pop("template_items", []))

    raw_audios = data.pop("audio_tracks", []) or []
    data["audio_links"] = [
        {
            "audio_track_id": str(a["audio_track_id"]),
            "volume": a.get("volume", 0.5),
            "loop": a.get("loop", True),
            "fade_in": a.get("fade_in", 2.0),
            "fade_out": a.get("fade_out", 2.0),
            "order_num": a.get("order_num", 0),
        }
        for a in raw_audios
    ]

    return data, raw_audios


def _convert_character(ch: models.PlayerCharacter) -> dict:
    owned_raw = getattr(ch, "owned_items", None) or []
    owned_items = []
    for it in owned_raw:
        if it is None:
            continue
        try:
            owned_items.append(scheme.GameItemOut.model_validate(it).model_dump(mode="python"))
        except Exception:
            # Fallback: keep id/name so inventory is not silently emptied.
            owned_items.append({
                "id": getattr(it, "id", None),
                "name": getattr(it, "name", None) or str(getattr(it, "id", "")),
                "data": getattr(it, "data", None) or {},
                "tags": getattr(it, "tags", None) or [],
            })
    return {
        "id": ch.id,
        "name": ch.name,
        "short_desc": ch.short_desc,
        "story": ch.story,
        "data": ch.data or {},
        "icon_url": ch.icon_url,
        "img_url": ch.img_url,
        "location_id": ch.location_id,
        "owned_items": owned_items,
        "player": _pick_one(getattr(ch, "player", None)),
    }



def _convert_location(loc) -> tuple[dict, list]:
    """Возвращает (location_dict, все_raw_audios из всех экспозиций)"""
    data = scheme.LocationOut.model_validate(loc).model_dump(mode="python")
    all_raw_audios = []
    exposures = []
    for se in (loc.scene_exposures or []):
        exp_dict, raw_audios = _convert_exposure(se)
        exposures.append(exp_dict)
        all_raw_audios.extend(raw_audios)
    data["scene_exposures"] = exposures
    return data, all_raw_audios


def _convert_story_beat(sb) -> tuple[dict, list]:
    """Возвращает (story_beat_dict, все_raw_audios из всех экспозиций)"""
    data = scheme.StoryBeatOut.model_validate(sb).model_dump(mode="python")
    all_raw_audios = []
    exposures = []
    for se in (sb.scene_exposures or []):
        exp_dict, raw_audios = _convert_exposure(se)
        exposures.append(exp_dict)
        all_raw_audios.extend(raw_audios)
    data["scene_exposures"] = exposures
    return data, all_raw_audios


def _collect_audio_tracks(raw_audios: list[dict]) -> list[dict]:
    """
    Из списка raw ExposureAudioLinkOut (с вложенным audio_track)
    собирает уникальные треки по audio_track_id.
    """
    seen: set[str] = set()
    tracks: list[dict] = []
    for a in raw_audios:
        track = a.get("audio_track")
        if not track:
            continue
        track_id = str(track.get("id") or a.get("audio_track_id", ""))
        if track_id in seen:
            continue
        seen.add(track_id)
        tracks.append(track)
    return tracks


def _free_items(items: list) -> list:
    return [
        it for it in (items or [])
        if getattr(it, "ownership_link", None) is None
    ]


def _visible_polygon_ids(locations: list[scheme.InnerLocation]) -> set[SAUUID]:
    ids: set[SAUUID] = set()
    for loc in locations:
        for p in (loc.map_objects or []):
            if p.is_shown:
                ids.add(p.id)
    return ids


def _convert_player(p: models.Player) -> dict:
    snapshot = p.character_snapshot or None
    character_id = p.character_id
    if character_id is None and snapshot:
        raw_id = snapshot.get("id")
        character_id = UUID(str(raw_id)) if raw_id else None

    return {
        "id": p.id,
        "name": p.name,
        "color": p.color,
        "icon_url": p.icon_url,
        "img_url": p.img_url,
        "user": p.user,
        "character_source_type": p.character_source_type,
        "character_id": character_id,
        "character_snapshot": snapshot,
        "character": snapshot,
    }

# ── основная сборка ──────────────────────────────────────────────────────────

async def build_session_inner(
    gs: models.GameSession,
    factories_payload: Any,
) -> scheme.GameSessionInner:
    """
    Принимает уже eager-loaded GameSession и собирает GameSessionInner.
    Не знает ничего про БД и Redis — только конвертирует.
    """
    scenario: models.Scenario = gs.scenario

    all_raw_audios: list[dict] = []

    locations: list[dict] = []
    for loc in (scenario.locations or []):
        loc_dict, raw_audios = _convert_location(loc)
        locations.append(loc_dict)
        all_raw_audios.extend(raw_audios)

    story_beats: list[dict] = []
    for sb in (scenario.story_beats or []):
        sb_dict, raw_audios = _convert_story_beat(sb)
        story_beats.append(sb_dict)
        all_raw_audios.extend(raw_audios)

    # уникальные треки → корень
    audio_tracks = _collect_audio_tracks(all_raw_audios)

    inner_scenario = scheme.InnerSecenario.model_validate({
        "id": gs.id,
        "scenario_id": gs.scenario_id,
        "name": scenario.name,
        "intro": scenario.intro,
        "user": scenario.user,
        "max_players": getattr(scenario, "max_players", None),
        "rule_id_str": getattr(scenario, "rule_id_str", None),
        "icon_url": getattr(scenario, "icon_url", None),
        "data": scenario.data or {},

        "locations":   locations,
        "story_beats": story_beats,
        "characters":   [_convert_character(ch)    for ch  in (scenario.characters or [])],
        "npcs":         scenario.npcs or [],
        "items":        _free_items(scenario.items),
        "notes":        scenario.notes or [],
        "counters":     scenario.counters or [],
        "settings":     scheme.Settings().model_dump(mode="json"),
        "audio":       audio_tracks,   # ← все треки сценария одним списком

        "seen":           _as_uuid_set(getattr(gs, "seen", None)),
        "polygon_shown":  _as_uuid_set(getattr(gs, "polygon_shown", None)),
        "factories":      factories_payload,
    })

    return scheme.GameSessionInner.model_validate({
        **inner_scenario.model_dump(mode="json"),
        "id": gs.id,
        "scenario_id": gs.scenario_id,
        "name": gs.name,
        "created_at": gs.created_at,
        "master": gs.master,
        "players": [_convert_player(p) for p in (gs.players or [])],
        "logs": getattr(gs, "logs", None) or [],
        "notifications": getattr(gs, "notifications", None) or [],
        "scenes": getattr(gs, "scenes", None) or [],
        "settings": scheme.Settings(),
        "obstacles": [],
        "polygon_shown": _visible_polygon_ids(inner_scenario.locations),
    })


def exposure_to_inner_dict(orm_exposure) -> Dict[str, Any]:
    data, _raw_audios = _convert_exposure(orm_exposure)

    raw_items = data.pop("items", []) or []
    raw_npcs = data.pop("npcs", []) or []
    obstacles = data.get("obstacles") or []

    item_ids: List[UUID] = []
    for it in raw_items:
        it_id = getattr(it, "id", None)
        if it_id is None and isinstance(it, dict):
            it_id = it.get("id")
        if it_id is None:
            continue
        item_ids.append(UUID(str(it_id)))

    npc_ids: List[UUID] = []
    for n in raw_npcs:
        n_id = getattr(n, "id", None)
        if n_id is None and isinstance(n, dict):
            n_id = n.get("id")
        if n_id is None:
            continue
        npc_ids.append(UUID(str(n_id)))

    data["item_ids"] = item_ids
    data["npc_ids"] = npc_ids
    data["obstacles"] = obstacles
    return data


def dump_locations_with_exposition(orm_locations: Iterable[Any]) -> List[Dict[str, Any]]:
    res: List[Dict[str, Any]] = []
    for loc in orm_locations:
        loc_out = scheme.LocationOut.model_validate(loc)
        loc_data = loc_out.model_dump(mode="python")
        loc_data["scene_exposures"] = [
            exposure_to_inner_dict(se) for se in (loc.scene_exposures or [])
        ]
        res.append(loc_data)
    return res


def dump_story_beats_with_exposition(orm_beats: Iterable[Any]) -> List[Dict[str, Any]]:
    res: List[Dict[str, Any]] = []
    for sb in orm_beats:
        sb_out = scheme.StoryBeatOut.model_validate(sb)
        sb_data = sb_out.model_dump(mode="python")
        sb_data["scene_exposures"] = [
            exposure_to_inner_dict(se) for se in (sb.scene_exposures or [])
        ]
        res.append(sb_data)
    return res
