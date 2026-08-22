"""Entity visibility by party/episode tags and master filter."""

from __future__ import annotations

from typing import Iterable, Optional, Sequence
from uuid import UUID


def _norm_tags(tags: Optional[Sequence[str]]) -> list[str]:
    if not tags:
        return []
    return [str(t) for t in tags if t]


def entity_party_tags(tags: Optional[Sequence[str]]) -> list[str]:
    return [t for t in _norm_tags(tags) if t.startswith("party:")]


def entity_episode_tags(tags: Optional[Sequence[str]]) -> list[str]:
    return [t for t in _norm_tags(tags) if t.startswith("ep:")]


def entity_visible_for_party(
    entity_tags: Optional[Sequence[str]],
    party_filter_tags: Optional[Sequence[str]],
) -> bool:
    """Entity without party: tags is visible to all parties."""
    party_tags = entity_party_tags(entity_tags)
    if not party_tags:
        return True
    if not party_filter_tags:
        return False
    allowed = set(_norm_tags(party_filter_tags))
    return bool(allowed.intersection(party_tags))


def entity_visible_for_master_filter(
    entity_tags: Optional[Sequence[str]],
    master_filter_tags: Optional[Sequence[str]],
) -> bool:
    if not master_filter_tags:
        return True
    wanted = set(_norm_tags(master_filter_tags))
    if not wanted:
        return True
    tags = set(_norm_tags(entity_tags))
    ep_tags = {t for t in tags if t.startswith("ep:")}
    party_tags = {t for t in tags if t.startswith("party:")}
    scoped = ep_tags | party_tags
    if not scoped:
        return True
    return bool(wanted.intersection(scoped))


def filter_entities_for_party(
    entities: Iterable,
    party_filter_tags: Optional[Sequence[str]],
) -> list:
    return [
        e for e in entities
        if entity_visible_for_party(getattr(e, "tags", None), party_filter_tags)
    ]


def filter_entities_for_master(
    entities: Iterable,
    master_filter_tags: Optional[Sequence[str]],
) -> list:
    return [
        e for e in entities
        if entity_visible_for_master_filter(getattr(e, "tags", None), master_filter_tags)
    ]
