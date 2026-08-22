# codex/tags.py
from __future__ import annotations

from typing import Iterable

from ..types import TagDef, TagCategory

TAGS: list[TagDef] = [
    TagDef(id="two_handed", category="technique", title="Двуручное"),
    TagDef(id="shield", category="technique", title="Щит"),
    TagDef(id="polearm", category="technique", title="Древковое"),
    TagDef(id="thrust", category="technique", title="Колющее"),
    TagDef(id="cleave", category="technique", title="Рубящее"),
    TagDef(id="strike", category="technique", title="Ударное"),

    TagDef(id="metal", category="material", title="Металл"),
    TagDef(id="stone", category="material", title="Камень"),
    TagDef(id="wood", category="material", title="Дерево"),
    TagDef(id="leather", category="material", title="Кожа"),
    TagDef(id="steam", category="material", title="Пар"),
    TagDef(id="powder", category="material", title="Порох"),
    TagDef(id="runes", category="material", title="Руны"),

    TagDef(id="push", category="tactic", title="Натиск"),
    TagDef(id="hold", category="tactic", title="Удержание"),
    TagDef(id="duel", category="tactic", title="Дуэль"),
    TagDef(id="suppress", category="tactic", title="Подавление"),
    TagDef(id="dirty", category="tactic", title="Грязная игра"),
    TagDef(id="formation", category="tactic", title="Строй"),
]

_TAG_INDEX = {t.id: t for t in TAGS}

def all() -> list[TagDef]:
    return list(TAGS)

def ids() -> set[str]:
    return set(_TAG_INDEX.keys())

def by_category(cat: TagCategory) -> list[TagDef]:
    return [t for t in TAGS if t.category == cat]

def normalize_and_unknown(xs: Iterable[str]) -> tuple[list[str], list[str]]:
    norm: list[str] = []
    seen: set[str] = set()
    unknown: list[str] = []
    for x in xs:
        s = (x or "").strip()
        if not s or s in seen:
            continue
        seen.add(s)
        if s not in _TAG_INDEX:
            unknown.append(s)
            continue
        norm.append(s)
    return unknown, norm
