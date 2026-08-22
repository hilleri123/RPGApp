"""Keep rule_id_str alongside entity plugin data for copy/carryover integrity."""

from __future__ import annotations

import copy
from typing import Any, Iterable, Optional

from app.plugins.contracts import EntityPayload
from app.scheme.common import dump_entity_fields

RULE_ID_DATA_KEY = "rule_id_str"


def stamp_entity_data(data: dict[str, Any] | None, rule_id_str: str | None) -> dict[str, Any]:
    out = copy.deepcopy(data or {})
    if rule_id_str:
        out[RULE_ID_DATA_KEY] = rule_id_str
    return out


def resolve_rule_id_from_data(
    data: dict[str, Any] | None,
    *,
    fallback: str | None = None,
) -> str | None:
    if not data:
        return fallback
    raw = data.get(RULE_ID_DATA_KEY)
    if isinstance(raw, str) and raw.strip():
        return raw.strip()
    return fallback


def stamp_entity_payload(payload: EntityPayload, rule_id_str: str | None) -> EntityPayload:
    if not rule_id_str:
        return payload
    payload.data = stamp_entity_data(payload.data, rule_id_str)
    return payload


def merge_validated_entity_fields(
    *,
    payload: Any,
    plugin_payload: EntityPayload,
    exclude: Iterable[str] = (),
    tags: list[str] | None = None,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Merge REST payload fields with validated plugin output without duplicate kwargs."""
    plugin_data = plugin_payload.model_dump(mode="json")
    entity_data = dump_entity_fields(payload, exclude=set(exclude))
    for key in plugin_data:
        entity_data.pop(key, None)
    plugin_data.pop("tags", None)

    merged = {**entity_data, **plugin_data}
    if tags is not None:
        merged["tags"] = tags
    if extra:
        merged.update(extra)
    return merged
