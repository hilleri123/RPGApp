
from __future__ import annotations
from typing import Any, Protocol, Literal, Optional, runtime_checkable
from pydantic import BaseModel, Field, NonNegativeInt


# ---- Items ----

WeaponType = Literal["melee", "ranged"]
ArmorVs = Literal["melee", "ranged", "all"]


class ItemWeapon(BaseModel):
    type: WeaponType
    damage: str  # свободная строка: "1d6", "1d6+1", "2", etc.



class ItemArmor(BaseModel):
    rating: NonNegativeInt = 0
    vs: list[ArmorVs] = Field(default_factory=lambda: ["all"])



class ItemData(BaseModel):
    tags: list[str] = Field(default_factory=list)

    weapon: Optional[ItemWeapon] = None
    armor: Optional[ItemArmor] = None


class HasItems(BaseModel):
    items: list[ItemData] = Field(default_factory=list)