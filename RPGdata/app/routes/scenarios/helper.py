import json
from typing import Any, Dict, Type, Set
from uuid import UUID
from fastapi import HTTPException
from dataclasses import dataclass

from pydantic import ValidationError
from app import models
from app.scheme.universal_entity import UniversalUpsertPayload

@dataclass(frozen=True)
class EntitySpec:
    model: Type
    entity_fields: Set[str]

ENTITY_SPECS: Dict[str, EntitySpec] = {
    "character": EntitySpec(models.PlayerCharacter, {"name", "short_desc", "story", "icon_url", "img_url"}),
    "npc": EntitySpec(models.NPC, {"name", "description_for_master", "description_for_players", "is_dead", "is_enemy", "is_shown", "icon_url", "img_url"}),
    "item": EntitySpec(models.GameItem, {"name", "description_for_master", "description_for_players", "erase_on_use", "is_shown", "icon_url", "img_url", "item_scheme_id"}),
    "location": EntitySpec(models.Location, {
        "name", "description_for_master", "description_for_players",
        "is_shown", "is_start", "icon_url", "map_url",
        "map_width", "map_height", "parent_location_id",
    }),
}


def _model_for(t: str):
    m = ENTITY_SPECS[t].model
    if not m:
        raise HTTPException(400, f"Unknown type: {t}")
    return m


def _apply_entity_fields(obj: Any, t: str, fields: Dict[str, Any]) -> None:
    allowed = ENTITY_SPECS[t].entity_fields

    for k, v in (fields or {}).items():
        if k in allowed:
            setattr(obj, k, v)

def _entity_to_dict(obj: Any) -> Dict[str, Any]:
    # минимальный сериализатор (для прототипа)
    d = {}
    for k in obj.__dict__.keys():
        if k.startswith("_"):
            continue
        v = getattr(obj, k)
        try:
            # UUID/json ok
            d[k] = str(v) if isinstance(v, UUID) else v
        except Exception:
            pass
    # schema/relationships сюда не тащим
    return d




async def _parse_payload(payload_raw: str) -> UniversalUpsertPayload:
    try:
        data = json.loads(payload_raw)
    except json.JSONDecodeError:
        raise HTTPException(400, "payload is not valid JSON")

    try:
        return UniversalUpsertPayload(**data)
    except ValidationError as e:
        # можно вернуть детали, но коротко:
        raise HTTPException(422, "payload validation error")


