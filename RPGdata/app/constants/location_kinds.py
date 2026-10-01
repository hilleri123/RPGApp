"""Terrain kinds of a location, stored as a namespaced tag ``loc:<id>``.

Kept in the ordinary ``Location.tags`` list so that cloning, launching and every
tag filter keep working untouched. A location has at most one kind. The Russian
titles are shown by the client (``app/lib/locationKinds.ts`` mirrors this table).
"""

from __future__ import annotations

from typing import Iterable

LOCATION_KIND_PREFIX = "loc:"

# (id, title_ru) from the biggest to the smallest scale, then special places.
LOCATION_KINDS: tuple[tuple[str, str], ...] = (
    ("world", "Мир"),
    ("continent", "Континент"),
    ("ocean", "Море / океан"),
    ("island", "Остров"),
    ("country", "Страна"),
    ("region", "Регион"),
    ("wilderness", "Дикие земли"),
    ("forest", "Лес"),
    ("mountains", "Горы"),
    ("city", "Город"),
    ("village", "Деревня"),
    ("district", "Район / квартал"),
    ("street", "Улица"),
    ("building", "Здание / дом"),
    ("apartment", "Квартира"),
    ("room", "Комната"),
    ("tavern", "Таверна / заведение"),
    ("dungeon", "Подземелье"),
    ("ship", "Корабль / транспорт"),
    ("other", "Другое"),
)

LOCATION_KIND_IDS = frozenset(k for k, _ in LOCATION_KINDS)


def kind_tag(kind_id: str) -> str:
    return f"{LOCATION_KIND_PREFIX}{kind_id}"


def is_kind_tag(tag: object) -> bool:
    return isinstance(tag, str) and tag.startswith(LOCATION_KIND_PREFIX)


def kind_of(tags: Iterable[object] | None) -> str | None:
    """First known kind id found in ``tags`` (None if the location has none)."""
    for tag in tags or ():
        if is_kind_tag(tag):
            kind_id = str(tag)[len(LOCATION_KIND_PREFIX):]
            if kind_id in LOCATION_KIND_IDS:
                return kind_id
    return None
