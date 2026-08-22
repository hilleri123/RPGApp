"""Map scene.data.mode to perform-move context tags."""

from __future__ import annotations

from typing import Iterable

SceneMode = str  # travel | camp | action

_LEGACY_MODE_MAP = {
    "rest": "camp",
    "action": "action",
    "travel": "travel",
    "camp": "camp",
}


def normalize_scene_mode(mode: str | None) -> str:
    raw = str(mode or "action").strip().lower()
    return _LEGACY_MODE_MAP.get(raw, raw if raw in ("travel", "camp", "action") else "action")


def scene_context_tags(scene_data: dict | None) -> set[str]:
    mode = normalize_scene_mode((scene_data or {}).get("mode"))
    return {mode}
