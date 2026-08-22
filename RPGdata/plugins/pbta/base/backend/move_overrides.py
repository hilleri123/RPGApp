from __future__ import annotations

from typing import Any

from .types import Move, MoveTextOverride


def parse_move_overrides(actor_data: dict[str, Any] | None) -> dict[str, MoveTextOverride]:
    if not actor_data:
        return {}
    raw = actor_data.get("move_overrides") or {}
    if not isinstance(raw, dict):
        return {}
    out: dict[str, MoveTextOverride] = {}
    for mid, val in raw.items():
        if not mid:
            continue
        try:
            if isinstance(val, MoveTextOverride):
                out[str(mid)] = val
            elif isinstance(val, dict):
                out[str(mid)] = MoveTextOverride.model_validate(val)
        except Exception:
            continue
    return out


def apply_move_override(base: Move, ov: MoveTextOverride) -> Move:
    updates: dict[str, Any] = {}
    for field in (
        "title",
        "summary",
        "trigger",
        "effect",
        "effect_10_plus",
        "effect_7_9",
        "effect_6_minus",
    ):
        val = getattr(ov, field, "")
        if val:
            updates[field] = val
    if not updates:
        return base
    return base.model_copy(update=updates)


def has_move_override(ov: MoveTextOverride | None) -> bool:
    if ov is None:
        return False
    return bool(
        (ov.title or ov.summary or ov.trigger or ov.effect)
        or ov.effect_10_plus
        or ov.effect_7_9
        or ov.effect_6_minus
    )
