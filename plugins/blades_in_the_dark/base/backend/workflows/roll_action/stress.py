from __future__ import annotations

from typing import Any, Optional, Tuple

from .scene import find_character_ref, character_data, get_stress

STRESS_MAX_DEFAULT = 9


def patch_character_data(character_id: str, data_patch: dict[str, Any]) -> dict[str, Any]:
    return {"characters": [{"id": str(character_id), "data": data_patch}]}


def _append_stress_event(wf, ev: dict[str, Any]) -> None:
    lst = wf.context.get("stressEvents")
    if not isinstance(lst, list):
        lst = []
    lst.append(ev)
    wf.context["stressEvents"] = lst


def _stress_max(ch_data: dict[str, Any]) -> int:
    # опционально, если появится в модели:
    n = ch_data.get("stress_max") or ch_data.get("stressMax")
    try:
        if n is not None:
            n2 = int(n)
            if n2 > 0:
                return n2
    except Exception:
        pass
    return STRESS_MAX_DEFAULT


def apply_stress(
    *,
    wf,
    scene: dict[str, Any],
    character_id: str,
    delta: int,
    reason: str,
    meta: Optional[dict[str, Any]] = None,
) -> Tuple[Optional[dict[str, Any]], bool]:
    """
    Возвращает (sessionPatch, overflow_to_trauma).
    overflow => stress=0, а trauma выбирает GM в wrap_up. [web:151]
    """
    ch_ref = find_character_ref(scene, str(character_id))
    if not ch_ref:
        return None, False

    ch_data = character_data(ch_ref)
    old = int(get_stress(ch_data) or 0)
    mx = _stress_max(ch_data)
    new_raw = old + int(delta)

    overflow = new_raw >= mx
    new_stress = 0 if overflow else new_raw

    _append_stress_event(wf, {
        "character_id": str(character_id),
        "old": old,
        "delta": int(delta),
        "new": new_stress,
        "max": mx,
        "overflow": bool(overflow),
        "reason": reason,
        "meta": meta or {},
    })

    if overflow:
        wf.context["needsTrauma"] = True
        wf.context["traumaCharacterId"] = str(character_id)

    return patch_character_data(str(character_id), {"stress": new_stress}), overflow
