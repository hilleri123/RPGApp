from __future__ import annotations

from typing import Any

from .move_overrides import apply_move_override, parse_move_overrides
from .types import CustomMove, Move, MoveCondition, MoveGrantResource


def parse_custom_moves(actor_data: dict[str, Any] | None) -> list[CustomMove]:
    if not actor_data:
        return []
    out: list[CustomMove] = []
    for raw in actor_data.get("custom_moves") or []:
        if isinstance(raw, CustomMove):
            out.append(raw)
        elif isinstance(raw, dict):
            try:
                out.append(CustomMove.model_validate(raw))
            except Exception:
                continue
    return out


def custom_move_to_move(cm: CustomMove) -> Move:
    return Move(
        id=cm.id,
        title=cm.title,
        kind="custom",
        tags=["custom", *(cm.tags or [])],
        condition=MoveCondition(),
        available_stats=list(cm.available_stats or []),
        summary=cm.summary,
        trigger=cm.trigger,
        effect=cm.effect,
        effect_10_plus=cm.effect_10_plus,
        effect_7_9=cm.effect_7_9,
        effect_6_minus=cm.effect_6_minus,
        grant_resources=list(cm.grant_resources or []),
    )


def active_custom_moves(actor_data: dict[str, Any] | None) -> list[Move]:
    """Кастомные ходы, включённые в moves персонажа."""
    if not actor_data:
        return []
    active_ids = {str(x) for x in (actor_data.get("moves") or [])}
    return [
        custom_move_to_move(cm)
        for cm in parse_custom_moves(actor_data)
        if cm.id in active_ids
    ]


def merge_moves_map(
    base_map: dict[str, Move],
    actor_data: dict[str, Any] | None = None,
) -> dict[str, Move]:
    merged = dict(base_map)
    for mid, ov in parse_move_overrides(actor_data).items():
        base = merged.get(mid)
        if base is not None:
            merged[mid] = apply_move_override(base, ov)
    for move in active_custom_moves(actor_data):
        merged[move.id] = move
    return merged
