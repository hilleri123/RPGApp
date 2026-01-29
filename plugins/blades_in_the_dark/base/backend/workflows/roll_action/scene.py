from __future__ import annotations
from typing import Any, Optional

def find_character_ref(scene: dict[str, Any], character_id: str) -> dict[str, Any]:
    players = scene.get("players") or {}
    for _uid, entry in players.items():
        for ch in (entry.get("characters") or []):
            if str(ch.get("id")) == str(character_id):
                return ch
    return {}

def character_data(ch_ref: dict[str, Any]) -> dict[str, Any]:
    d = ch_ref.get("data")
    return d if isinstance(d, dict) else {}

def character_name(ch_ref: dict[str, Any]) -> str:
    n = ch_ref.get("name")
    return str(n) if n else str(ch_ref.get("id") or "—")

def action_rating(character_data: dict[str, Any], action: str) -> int:
    actions = character_data.get("actions") or {}
    try:
        v = int(actions.get(action, 0))
    except Exception:
        v = 0
    return max(0, v)

def attribute_rating(character_data: dict[str, Any], action_to_attr: dict[str, str], attr: str) -> int:
    actions = character_data.get("actions") or {}
    cnt = 0
    for aid, a_attr in action_to_attr.items():
        if a_attr != attr:
            continue
        try:
            v = int(actions.get(aid, 0))
        except Exception:
            v = 0
        if v > 0:
            cnt += 1
    return cnt

def get_stress(character_data: dict[str, Any]) -> int:
    try:
        return max(0, int(character_data.get("stress") or 0))
    except Exception:
        return 0
