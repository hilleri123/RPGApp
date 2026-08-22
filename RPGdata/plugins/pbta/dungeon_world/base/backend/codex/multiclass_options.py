from __future__ import annotations

from plugins.pbta.base.backend.types.types_classes import MovePlaceholder

MULTICLASS_MOVE_PLACEHOLDERS = [
    MovePlaceholder(
        id="picked_move",
        label="Ход другого класса",
        kind="move_pick",
        required=True,
        level_delta=-1,
    ),
]

MULTICLASS_EFFECT_TEXT = "Дополнительный ход другого класса: {{picked_move}}."
