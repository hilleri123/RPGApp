# plugins/gumshoe/attack/types.py
from __future__ import annotations
from typing import Optional, Literal, List
from uuid import UUID
from pydantic import BaseModel, Field, NonNegativeInt

WeaponMode = Literal["melee", "ranged"]

class AttackEntry(BaseModel):
    # кто бьёт
    attackerUserId: UUID
    # ЛИБО персонаж, ЛИБО NPC (один из них None)
    attackerCharacterId: Optional[UUID] = None
    attackerNpcId:       Optional[UUID] = None

    # цель — ЛИБО NPC, ЛИБО персонаж
    targetNpcId:        Optional[UUID] = None
    targetNpcName:      str = ""
    targetCharacterId:  Optional[UUID] = None
    targetCharacterName: str = ""

    # оружие / атака
    weaponItemId:   Optional[UUID] = None   # если атакующий — персонаж
    weaponName:     str = ""
    attackName:     str = ""                # если атакующий — NPC (NPCAttack.name)
    weaponMode:     Optional[WeaponMode] = None

    skill_id:     str = ""
    skill_points: NonNegativeInt = 0

    # бросок
    canvas_seed:  Optional[str] = None
    dice:         Optional[List[int]] = None
    result_hit:   Optional[bool] = None
    result_text:  Optional[str] = None

    # урон
    damage_seed:     str = ""
    damage_rolls:    List[int] = Field(default_factory=list)
    damage_modifier: int = 0
    damage_total:    int = 0
    damage_text:     str = ""


class AttackContext(BaseModel):
    sceneId: UUID
    entry: AttackEntry
