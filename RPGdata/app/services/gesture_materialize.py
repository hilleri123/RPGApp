"""Замена data-url картинки жеста на id и url. Без базы: файл и строка."""

from __future__ import annotations

from typing import Any

SEED_KEYS = frozenset({"roll_seed", "damage_seed", "seed", "canvas_seed", "canvasSeed"})


def is_image_data_url(value: Any) -> bool:
    return isinstance(value, str) and value.startswith("data:image")


def collect_image_seeds(node: Any, path: tuple = ()) -> list[tuple[tuple, str]]:
    found: list[tuple[tuple, str]] = []
    if isinstance(node, dict):
        for key, value in node.items():
            here = path + (key,)
            if key in SEED_KEYS and is_image_data_url(value):
                found.append((here, value))
            else:
                found.extend(collect_image_seeds(value, here))
    elif isinstance(node, list):
        for index, value in enumerate(node):
            found.extend(collect_image_seeds(value, path + (index,)))
    return found


def apply_gesture_refs(node: Any, replacements: dict[tuple, dict[str, str]]) -> Any:
    """Подменяет data-url на hash в поле seed и кладёт gesture_id / gesture_url рядом."""
    if isinstance(node, list):
        return [apply_gesture_refs(item, _shift(replacements, index)) for index, item in enumerate(node)]
    if not isinstance(node, dict):
        return node

    out: dict[str, Any] = {}
    for key, value in node.items():
        here = (key,)
        if here in replacements and key in SEED_KEYS:
            ref = replacements[here]
            out[key] = ref["seed_hash"]
            out[f"{key}_gesture_id"] = ref["gesture_id"]
            out[f"{key}_gesture_url"] = ref["gesture_url"]
            if key in ("roll_seed", "seed", "canvas_seed", "canvasSeed"):
                out["gesture_id"] = ref["gesture_id"]
                out["gesture_url"] = ref["gesture_url"]
        else:
            nested = {k[1:]: v for k, v in replacements.items() if k and k[0] == key}
            out[key] = apply_gesture_refs(value, nested) if nested else value
    return out


def _shift(replacements: dict[tuple, dict[str, str]], index: int) -> dict[tuple, dict[str, str]]:
    return {k[1:]: v for k, v in replacements.items() if k and k[0] == index}
