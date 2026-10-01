"""Kinds of a location, stored as a namespaced tag ``loc:<id>``.

Kept in the ordinary ``Location.tags`` list so that cloning, launching and every
tag filter keep working untouched. A location has at most one kind. The Russian
titles are shown by the client (``app/lib/locationKinds.ts`` mirrors this module).

The kinds form a fixed hierarchy (``LOCATION_KIND_CHILDREN``):

    Мир
    └─ Регион
       ├─ Город / поселение ──┬─ Район / улица ── Здание ──┬─ Комната
       │                      ├─ Здание ──────────────────┤
       │                      └─ Подземелье               └─ Подземелье ── Комната
       ├─ Дикие земли ── Город / Здание / Подземелье
       └─ Подземелье
"""

from __future__ import annotations

from typing import Iterable

LOCATION_KIND_PREFIX = "loc:"

# (id, title_ru), ordered by hierarchy level (see LOCATION_KIND_LEVEL).
LOCATION_KINDS: tuple[tuple[str, str], ...] = (
    ("world", "Мир"),
    ("region", "Регион"),
    ("city", "Город / поселение"),
    ("wilds", "Дикие земли"),
    ("dungeon", "Подземелье"),
    ("district", "Район / улица"),
    ("building", "Здание"),
    ("room", "Комната"),
)

LOCATION_KIND_IDS = frozenset(k for k, _ in LOCATION_KINDS)

# Depth of the kind in the hierarchy: used for the visual ladder in the editor.
LOCATION_KIND_LEVEL: dict[str, int] = {
    "world": 0,
    "region": 1,
    "city": 2,
    "wilds": 2,
    "dungeon": 2,
    "district": 3,
    "building": 4,
    "room": 5,
}

# Direct children in the hierarchy (the tree itself). What may actually live inside a
# location is every *descendant* kind (children, grandchildren, ...), see
# ``LOCATION_KIND_DESCENDANTS``: a room may sit straight in a city, skipping the district.
# A location without a kind (or an unknown parent kind) puts no restriction on its children.
LOCATION_KIND_CHILDREN: dict[str, tuple[str, ...]] = {
    "world": ("region",),
    "region": ("city", "wilds", "dungeon"),
    "city": ("district", "building", "dungeon"),
    "wilds": ("city", "building", "dungeon"),
    "dungeon": ("room",),
    "district": ("building",),
    "building": ("room", "dungeon"),
    "room": (),
}

def _descendants(kind_id: str, seen: frozenset[str] = frozenset()) -> set[str]:
    out: set[str] = set()
    for child in LOCATION_KIND_CHILDREN[kind_id]:
        if child in seen:
            continue
        out.add(child)
        out |= _descendants(child, seen | {kind_id})
    return out


# Every kind that may be placed (at any depth) inside a location of the given kind,
# in hierarchy order.
LOCATION_KIND_DESCENDANTS: dict[str, tuple[str, ...]] = {
    parent: tuple(k for k, _ in LOCATION_KINDS if k in _descendants(parent))
    for parent in LOCATION_KIND_CHILDREN
}

# Kinds that existed before the hierarchy was reduced. ``None`` = the kind is dropped.
LEGACY_KIND_ALIASES: dict[str, str | None] = {
    "continent": "region",
    "ocean": "region",
    "island": "region",
    "country": "region",
    "wilderness": "wilds",
    "forest": "wilds",
    "mountains": "wilds",
    "village": "city",
    "street": "district",
    "tavern": "building",
    "ship": "building",
    "apartment": "room",
    "other": None,
}


def canonical_kind(kind_id: object) -> str | None:
    """Current kind id for ``kind_id`` (legacy ids are mapped); None if unknown/dropped."""
    if not isinstance(kind_id, str):
        return None
    if kind_id in LOCATION_KIND_IDS:
        return kind_id
    return LEGACY_KIND_ALIASES.get(kind_id)


def kind_tag(kind_id: str) -> str:
    return f"{LOCATION_KIND_PREFIX}{kind_id}"


def is_kind_tag(tag: object) -> bool:
    return isinstance(tag, str) and tag.startswith(LOCATION_KIND_PREFIX)


def kind_of(tags: Iterable[object] | None) -> str | None:
    """First known kind id found in ``tags`` (None if the location has none)."""
    for tag in tags or ():
        if is_kind_tag(tag):
            kind_id = canonical_kind(str(tag)[len(LOCATION_KIND_PREFIX):])
            if kind_id:
                return kind_id
    return None


def allowed_child_kinds(parent_kind: str | None) -> tuple[str, ...]:
    """Kinds allowed inside a location of ``parent_kind``.

    That is the same kind (a region may contain a region) plus every descendant
    (children, grandchildren, ...). Without a parent kind — any.
    """
    parent = canonical_kind(parent_kind)
    if parent is None:
        return tuple(k for k, _ in LOCATION_KINDS)
    descendants = set(LOCATION_KIND_DESCENDANTS[parent])
    return tuple(k for k, _ in LOCATION_KINDS if k == parent or k in descendants)


def with_kind(tags: Iterable[object] | None, kind_id: str | None) -> list[str]:
    """Tags without any ``loc:*`` + (optionally) the new kind — never more than one kind."""
    rest = [str(t) for t in (tags or ()) if not is_kind_tag(t)]
    canonical = canonical_kind(kind_id)
    if canonical:
        rest.append(kind_tag(canonical))
    return rest


def normalize_kind_tags(tags: Iterable[object] | None) -> list[str]:
    """Rewrites legacy ``loc:*`` tags to the current kind (or drops them)."""
    return with_kind(tags, kind_of(tags))
