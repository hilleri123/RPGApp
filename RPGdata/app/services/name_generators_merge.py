from __future__ import annotations

from typing import Any

PART_KINDS = ("given", "family", "nickname", "full")


def merge_name_generators_config(
    base: dict[str, Any] | None,
    pack_entries: list[dict[str, Any]],
) -> dict[str, Any]:
    cfg = dict(base or {})
    entries = list(cfg.get("entries") or [])
    entries.extend(pack_entries)
    tag_set: set[str] = set(cfg.get("tags") or [])
    for e in entries:
        for t in e.get("tags") or []:
            tag_set.add(t)
    cfg["entries"] = entries
    cfg["tags"] = sorted(tag_set)
    cfg["partKinds"] = list(PART_KINDS)
    return cfg
