from __future__ import annotations

from typing import Any, Optional, Tuple

from plugins.common.types import SceneContext
from ...types import CharacterData

STRESS_MAX_DEFAULT = 9


def patch_character_data(character_id: str, data_patch: dict[str, Any]) -> dict[str, Any]:
    return {
        "character": {
            "id": str(character_id),
            "dataPatch": data_patch,
        }
    }

def _append_stress_event(wf, ev: dict[str, Any]) -> None:
    lst = wf.context.get("stressEvents")
    if not isinstance(lst, list):
        lst = []
    lst.append(ev)
    wf.context["stressEvents"] = lst




def apply_stress(
    *,
    wf,
    scene: SceneContext,
    character_id: str,
    delta: int,
    reason: str,
    meta: Optional[dict[str, Any]] = None,
) -> Tuple[Optional[dict[str, Any]], bool]:
    """
    Возвращает (sessionPatch, overflow_to_trauma).
    overflow => stress=0, а trauma выбирает GM в wrap_up. [web:151]
    """
    ch_ref = next((c for c in scene.characters if str(c.id) == character_id), None)
    if ch_ref is None:
        return None, False

    ch_data = CharacterData.model_validate(ch_ref.data)
    old = int(ch_data.stress or 0)
    new_raw = old + int(delta)

    overflow = new_raw >= STRESS_MAX_DEFAULT
    new_stress = 0 if overflow else new_raw

    _append_stress_event(wf, {
        "character_id": str(character_id),
        "old": old,
        "delta": int(delta),
        "new": new_stress,
        "max": STRESS_MAX_DEFAULT,
        "overflow": bool(overflow),
        "reason": reason,
        "meta": meta or {},
    })

    if overflow:
        wf.context["needsTrauma"] = True
        wf.context["traumaCharacterId"] = str(character_id)

    return patch_character_data(str(character_id), {"stress": new_stress}), overflow
