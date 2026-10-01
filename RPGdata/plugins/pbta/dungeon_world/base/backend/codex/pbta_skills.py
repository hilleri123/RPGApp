from __future__ import annotations
from plugins.pbta.base.backend.codex import PbtaSkillsCodex as PbtaSkillsCodexBase
from plugins.pbta.base.backend.types import Skill


_MODIFIER_TABLE: list[tuple[int, int]] = [
    (3,  -3),
    (5,  -2),
    (8,  -1),
    (12,  0),
    (15, +1),
    (17, +2),
    (18, +3),
]


def stat_modifier(value: int) -> int:
    for threshold, mod in _MODIFIER_TABLE:
        if value <= threshold:
            return mod
    return +3


class DwSkillsCodex(PbtaSkillsCodexBase):
    def get_skills(self) -> list[Skill]:
        return [
            Skill(id="str", title="Сила",         color="#ef4444"),
            Skill(id="dex", title="Ловкость",      color="#22c55e"),
            Skill(id="con", title="Телосложение",  color="#eab308"),
            Skill(id="int", title="Интеллект",     color="#0400ff"),
            Skill(id="wis", title="Мудрость",      color="#00d7fd"),
            Skill(id="cha", title="Харизма",       color="#f408fc"),
        ]

    def get_modifier(self, value: int) -> int:
        return stat_modifier(value)


# обратная совместимость — старый код импортирует PbtaSkillsCodex из этого модуля
PbtaSkillsCodex = DwSkillsCodex