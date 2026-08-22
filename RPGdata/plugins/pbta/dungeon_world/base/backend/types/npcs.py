from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field

# ── Организационные теги монстра ─────────────────────────────────────────────
# определяют масштаб и поведение [web:111]
MonsterGroupTag = str  # Solitary | Group | Horde

# ── Ход мастера (monster move) ────────────────────────────────────────────────

class NpcMove(BaseModel):
    id:          str
    title:       str        # "Enmesh in webbing"
    description: str = ""   # детали эффекта
    is_hard:     bool = False

# ── Атака NPC ─────────────────────────────────────────────────────────────────

class NpcAttack(BaseModel):
    name:         str               # "Mandibles", "Claws", "Freezing Touch"
    damage:       str               # "d8+2", "d6", "2d6"
    range_tags:   list[str] = Field(default_factory=list)   # close, reach, far...
    attack_tags:  list[str] = Field(default_factory=list)   # messy, forceful, ignores-armor...

# ── Данные NPC ────────────────────────────────────────────────────────────────

class NpcData(BaseModel):
    # ── боевые параметры ─────────────────────────────────────────────────────
    hp:           int = 6
    hp_current:   int = 6
    armor:        int = 0

    # ── атаки ────────────────────────────────────────────────────────────────
    attacks: list[NpcAttack] = Field(default_factory=list)

    # ── нарратив ─────────────────────────────────────────────────────────────
    instinct:         str = ""   # "To consume all warmth"
    moves:            list[NpcMove] = Field(default_factory=list)

    # ── теги ─────────────────────────────────────────────────────────────────
    group_tags:        list[str] = Field(default_factory=list)  # Solitary, Horde...
    special_qualities: list[str] = Field(default_factory=list)  # Burrowing, Intangible...
