"""Entity pack helpers and constants."""

from __future__ import annotations

from typing import Iterable

DEFAULT_PACK_TAG = "default"


def normalize_pack_tags(tags: Iterable[str] | None) -> list[str]:
    if not tags:
        return []
    return [str(t) for t in tags if t]


def pack_has_tag(tags: Iterable[str] | None, tag: str) -> bool:
    return tag in normalize_pack_tags(tags)


def is_default_pack_tags(tags: Iterable[str] | None) -> bool:
    return pack_has_tag(tags, DEFAULT_PACK_TAG)
