
from __future__ import annotations
from typing import Literal, Optional
from pydantic import BaseModel, Field

# ── Тэги ──────────────────────────────────────────────────────────────────────

RangeTag         = Literal["hand", "close", "reach", "near", "far"]
WeaponMechanicTag = Literal[
    "two-handed", "forceful", "precise",
    "reload", "thrown", "messy", "ignores-armor",
]
ArmorMechanicTag  = Literal["worn", "clumsy", "shield"]
GeneralTag        = Literal["magical", "awkward", "dangerous", "applied", "slow", "valuable"]

# ── Суб-структуры ─────────────────────────────────────────────────────────────

class DamageBonus(BaseModel):
    bonus: int = 1              # +1, +2 damage

class PiercingTag(BaseModel):
    value: int = 1              # n piercing

class AmmoTag(BaseModel):
    value: int = 3              # n ammo

class ArmorValue(BaseModel):
    value: int = 1
    stacks: bool = False        # False = "n armor", True = "+n armor" (щит)

# ── Компоненты предмета ───────────────────────────────────────────────────────

class ItemWeapon(BaseModel):
    range_tags:    list[RangeTag]          = Field(default_factory=list)
    mechanic_tags: list[WeaponMechanicTag] = Field(default_factory=list)
    damage_dice:   Optional[str]           = None
    damage_bonus:  Optional[DamageBonus]   = None
    piercing:      Optional[PiercingTag]   = None
    ammo:          Optional[AmmoTag]       = None

class ItemArmor(BaseModel):
    armor:         Optional[ArmorValue]    = None
    mechanic_tags: list[ArmorMechanicTag]  = Field(default_factory=list)

# ── Данные предмета (хранится в БД) ──────────────────────────────────────────

class ItemData(BaseModel):
    general_tags: list[str]            = Field(default_factory=list)
    weight:       int                  = 1
    cost:         Optional[int]        = None
    weapon:       Optional[ItemWeapon] = None
    armor:        Optional[ItemArmor]  = None


class HasItems(BaseModel):
    items: list[ItemData] = Field(default_factory=list)