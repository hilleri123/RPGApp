"""Helpers for canonical player-seen entity keys."""

from __future__ import annotations

from typing import Any, Iterable
from uuid import UUID

CLONEABLE_ENTITY_TYPES = frozenset({"npc", "game_item", "player_character"})


def canonical_seen_id(
    *,
    entity_type: str,
    entity_id: UUID,
    copied_from: UUID | None,
) -> UUID:
    """Return the id stored in player_seen (template parent for clones)."""
    if entity_type in CLONEABLE_ENTITY_TYPES and copied_from is not None:
        return copied_from
    return entity_id


def _copied_from_of(entity: Any) -> UUID | None:
    raw = getattr(entity, "copied_from", None)
    if raw is None:
        return None
    try:
        return UUID(str(raw))
    except (TypeError, ValueError):
        return None


def _entity_id_of(entity: Any) -> UUID | None:
    raw = getattr(entity, "id", None)
    if raw is None:
        return None
    try:
        return UUID(str(raw))
    except (TypeError, ValueError):
        return None


def resolve_seen_entry_from_inner(
    inner: Any,
    entity_id: UUID,
) -> tuple[str, UUID] | None:
    """Map a runtime entity id to (entity_type, canonical_seen_id)."""
    for loc in getattr(inner, "locations", None) or []:
        lid = _entity_id_of(loc)
        if lid == entity_id:
            return ("location", lid)

    for npc in getattr(inner, "npcs", None) or []:
        nid = _entity_id_of(npc)
        if nid == entity_id:
            return (
                "npc",
                canonical_seen_id(
                    entity_type="npc",
                    entity_id=nid,
                    copied_from=_copied_from_of(npc),
                ),
            )

    for item in getattr(inner, "items", None) or []:
        iid = _entity_id_of(item)
        if iid == entity_id:
            return (
                "game_item",
                canonical_seen_id(
                    entity_type="game_item",
                    entity_id=iid,
                    copied_from=_copied_from_of(item),
                ),
            )

    for ch in getattr(inner, "characters", None) or []:
        cid = _entity_id_of(ch)
        if cid == entity_id:
            return (
                "player_character",
                canonical_seen_id(
                    entity_type="player_character",
                    entity_id=cid,
                    copied_from=_copied_from_of(ch),
                ),
            )

    return None


def resolve_seen_entries_from_inner(
    inner: Any,
    entity_ids: Iterable[UUID],
) -> list[tuple[str, UUID]]:
    out: list[tuple[str, UUID]] = []
    seen_keys: set[tuple[str, UUID]] = set()
    for raw in entity_ids:
        entry = resolve_seen_entry_from_inner(inner, raw)
        if entry is None:
            entry = ("unknown", raw)
        if entry not in seen_keys:
            seen_keys.add(entry)
            out.append(entry)
    return out


def entity_matches_seen(
    *,
    entity_type: str,
    entity_id: UUID,
    copied_from: UUID | None,
    seen_ids: set[UUID],
) -> bool:
    canonical = canonical_seen_id(
        entity_type=entity_type,
        entity_id=entity_id,
        copied_from=copied_from,
    )
    return entity_id in seen_ids or canonical in seen_ids
