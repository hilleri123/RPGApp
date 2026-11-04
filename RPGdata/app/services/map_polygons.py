"""Полигоны из фигур Excalidraw. Подпись в центре фигуры становится именем, пока его не задали вручную."""

from __future__ import annotations

import re
from typing import Any

_SHAPE_TYPES = {"rectangle", "ellipse", "diamond", "freedraw", "line", "arrow"}
_AUTO_NAME = re.compile(r"^(rectangle|ellipse|diamond|freedraw|line|arrow) [0-9a-f]{4}$", re.I)


def _is_auto_name(name: str | None) -> bool:
    return bool(name and _AUTO_NAME.match(name.strip()))


def _polygon(el: dict) -> list[dict]:
    kind = el.get("type")
    x = float(el.get("x") or 0)
    y = float(el.get("y") or 0)
    w = float(el.get("width") or 0)
    h = float(el.get("height") or 0)
    if kind == "rectangle":
        return [{"x": x, "y": y}, {"x": x + w, "y": y}, {"x": x + w, "y": y + h}, {"x": x, "y": y + h}]
    if kind == "diamond":
        return [
            {"x": x + w / 2, "y": y},
            {"x": x + w, "y": y + h / 2},
            {"x": x + w / 2, "y": y + h},
            {"x": x, "y": y + h / 2},
        ]
    if kind == "ellipse":
        import math
        cx, cy, rx, ry = x + w / 2, y + h / 2, abs(w) / 2, abs(h) / 2
        steps = 32
        return [
            {"x": cx + math.cos(2 * math.pi * i / steps) * rx, "y": cy + math.sin(2 * math.pi * i / steps) * ry}
            for i in range(steps)
        ]
    if kind in {"line", "arrow", "freedraw"}:
        return [{"x": x + float(px), "y": y + float(py)} for px, py in (el.get("points") or [])]
    return []


def _point_in_polygon(px: float, py: float, polygon: list[dict]) -> bool:
    inside = False
    count = len(polygon)
    if count < 3:
        return False
    j = count - 1
    for i in range(count):
        xi, yi = polygon[i]["x"], polygon[i]["y"]
        xj, yj = polygon[j]["x"], polygon[j]["y"]
        if ((yi > py) != (yj > py)) and (px < (xj - xi) * (py - yi) / ((yj - yi) or 1e-9) + xi):
            inside = not inside
        j = i
    return inside


def _center(el: dict) -> tuple[float, float]:
    return (
        float(el.get("x") or 0) + float(el.get("width") or 0) / 2,
        float(el.get("y") or 0) + float(el.get("height") or 0) / 2,
    )


def label_for_element(el: dict, elements: list[dict]) -> str | None:
    bound = ""
    for text in elements:
        if text.get("type") != "text" or text.get("isDeleted"):
            continue
        if text.get("containerId") == el.get("id"):
            bound = str(text.get("text") or "").strip()
            break
    if bound:
        return bound
    polygon = _polygon(el)
    if len(polygon) < 3:
        return None
    best = None
    best_dist = None
    cx, cy = _center(el)
    for text in elements:
        if text.get("type") != "text" or text.get("isDeleted") or text.get("containerId"):
            continue
        value = str(text.get("text") or "").strip()
        if not value:
            continue
        tx, ty = _center(text)
        if not _point_in_polygon(tx, ty, polygon):
            continue
        dist = (tx - cx) ** 2 + (ty - cy) ** 2
        if best_dist is None or dist < best_dist:
            best = value
            best_dist = dist
    return best


def polygon_name(existing: dict | None, el: dict, elements: list[dict]) -> tuple[str, bool]:
    """Имя и флаг ручного имени. Автоимя вида rectangle abcd ручным не считается."""
    manual = bool(existing and existing.get("name_is_manual"))
    label = label_for_element(el, elements)
    fallback = f"{el.get('type')} {str(el.get('id') or '')[:4]}"
    if manual:
        return (str(existing.get("name") or label or fallback), True)
    if label:
        return (label, False)
    current = str((existing or {}).get("name") or "")
    if current and not _is_auto_name(current):
        return (current, False)
    return (fallback, False)


def elements_to_map_objects(
    elements: list[dict],
    existing: list[dict],
    location_id: str,
) -> list[dict]:
    by_internal = {item.get("internal_id"): item for item in existing if item.get("internal_id")}
    result = []
    for el in elements:
        if el.get("isDeleted") or el.get("type") not in _SHAPE_TYPES:
            continue
        polygon = _polygon(el)
        if len(polygon) < 2:
            continue
        prev = by_internal.get(el.get("id"))
        name, manual = polygon_name(prev, el, elements)
        color = (el.get("backgroundColor") or "") 
        if not color or color in {"transparent", "#ffffff00"}:
            color = el.get("strokeColor") or "#6366f1"
        is_line = el.get("type") in {"line", "arrow", "freedraw"}
        result.append({
            **(prev or {}),
            "internal_id": el.get("id"),
            "name": name,
            "name_is_manual": manual,
            "color": (prev or {}).get("color") or color,
            "polygon_list": polygon,
            "source_location_id": location_id,
            "target_location_id": (prev or {}).get("target_location_id"),
            "is_shown": (prev or {}).get("is_shown", True),
            "is_line": (prev or {}).get("is_line", is_line),
            "is_filled": (prev or {}).get("is_filled", not is_line),
            "alpha": (prev or {}).get("alpha", 0.5),
        })
    return result


def append_overlay_elements(base: dict | None, overlay_scene: dict | None, overlay_id: str) -> dict:
    scene = dict(base or {})
    elements = list(scene.get("elements") or [])
    files = dict(scene.get("files") or {})
    extra = (overlay_scene or {}).get("elements") or []
    for el in extra:
        if not isinstance(el, dict):
            continue
        copied = dict(el)
        copied["id"] = f"{overlay_id}:{el.get('id')}"
        if copied.get("containerId"):
            copied["containerId"] = f"{overlay_id}:{copied['containerId']}"
        elements.append(copied)
    files.update((overlay_scene or {}).get("files") or {})
    scene["elements"] = elements
    scene["files"] = files
    scene.setdefault("appState", (overlay_scene or {}).get("appState") or scene.get("appState") or {})
    return scene
