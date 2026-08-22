# codex/traits.py
from __future__ import annotations

from typing import Iterable

from ..types import Trait

TRAITS: list[Trait] = [
    Trait(id="no_disrespect", text="Когда мне проявляют неуважение — я обязан потребовать сатисфакции, иначе плачу цену."),
    Trait(id="hate_elves", text="Когда рядом эльфы/эльфийское — я обязан уколоть/унизить/сломать их превосходство, иначе плачу цену."),
    Trait(id="never_retreat", text="Когда бой идёт плохо — я обязан не отступать первым, иначе плачу цену."),
    Trait(id="fix_shoddy_work", text="Когда вижу халтуру — я обязан исправить или публично обозначить, иначе плачу цену."),
    Trait(id="everything_has_a_price", text="Когда меня просят о помощи — я обязан требовать плату/услугу, иначе плачу цену."),
]

_INDEX = {t.id: t for t in TRAITS if t.id}

def all() -> list[Trait]:
    return list(TRAITS)

def ids() -> set[str]:
    return set(_INDEX.keys())

def get(tid: str) -> Trait | None:
    return _INDEX.get((tid or "").strip())

def normalize_and_unknown_ids(ids_in: Iterable[str]) -> tuple[list[str], list[str]]:
    norm: list[str] = []
    seen: set[str] = set()
    unknown: list[str] = []
    for x in ids_in:
        s = (x or "").strip()
        if not s or s in seen:
            continue
        seen.add(s)
        if s not in _INDEX:
            unknown.append(s)
            continue
        norm.append(s)
    return unknown, norm
