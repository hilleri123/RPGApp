from __future__ import annotations
import json
from types import MappingProxyType

from ..types import PassiveDef

PASSIVES: list[PassiveDef] = [
    PassiveDef(
        id="passive_two_handed_mastery",
        title="Мастерство: двуручное",
        description="Чем больше связанных тэгов, тем выше уровень владения двуручным.",
        requiredTags=["two_handed"],
        keyTags=["two_handed", "cleave", "strike", "push", "metal"],
        grantsTags=["two_handed_user"],
        autoEnableAt="novice",
        grantsAt="trained",
    ),
    PassiveDef(
        id="passive_shield_wall",
        title="Щитовая стена",
        description="Пассивка для боя со щитом и удержанием.",
        requiredTags=["shield"],
        keyTags=["shield", "hold", "formation", "metal", "leather"],
        grantsTags=["shield_wall"],
        autoEnableAt="novice",
        grantsAt="master",
        obsession={"kind": "obsession", "text": "Держать строй, даже когда страшно."},
        obsessionAt="trained",
    ),
    PassiveDef(
        id="passive_polearm_drill",
        title="Древковая выучка",
        description="Контроль дистанции и подавление.",
        requiredTags=["polearm"],
        keyTags=["polearm", "thrust", "suppress", "formation", "wood"],
        grantsTags=["reach_control"],
        autoEnableAt="novice",
        grantsAt="trained",
    ),
    PassiveDef(
        id="passive_rune_discipline",
        title="Рунная дисциплина",
        description="Доступ к рунным приёмам (как ярлык через grantsTags).",
        requiredTags=["runes"],
        keyTags=["runes", "metal", "stone", "hold"],
        grantsTags=["rune_user"],
        autoEnableAt="novice",
        grantsAt="novice",
        obsession={"kind": "obsession", "text": "Всегда оставлять метку руны там, где это уместно."},
        obsessionAt="master",
    ),
]

_INDEX = {p.id: p for p in PASSIVES if p.id}


def _find_mappingproxy(x, path="root"):
    if isinstance(x, MappingProxyType):
        raise RuntimeError(f"mappingproxy at {path}")
    if isinstance(x, dict):
        for k, v in x.items():
            _find_mappingproxy(v, f"{path}.{k}")
    elif isinstance(x, list):
        for i, v in enumerate(x):
            _find_mappingproxy(v, f"{path}[{i}]")
    elif isinstance(x, tuple):
        for i, v in enumerate(x):
            _find_mappingproxy(v, f"{path}({i})")

def all() -> list[PassiveDef]:
    # диагностика
    for p in PASSIVES:
        d = p.model_dump()  # тут и упадёт, но если хочешь — сначала p.__dict__ проверить
        _find_mappingproxy(d, f"passive[{p.id}]")
        json.dumps(d)  # чтобы гарантировать JSON-сериализуемость
    return list(PASSIVES)

# def all() -> list[PassiveDef]:
#     return list(PASSIVES)


def ids() -> set[str]:
    return set(_INDEX.keys())


def get(pid: str) -> PassiveDef | None:
    return _INDEX.get((pid or "").strip())
