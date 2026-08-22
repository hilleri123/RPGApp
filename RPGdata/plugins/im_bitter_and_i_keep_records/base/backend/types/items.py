from __future__ import annotations

from typing import Any, Literal, Annotated, Union

from pydantic import BaseModel, ConfigDict, Field, NonNegativeInt

from .mastery import MasteryRules


DamageType = Literal["piercing", "slashing", "blunt", "fire", "cold", "electric"]
ItemType = Literal[
    "weapon", "armor", "shield", "tool", "consumable",
    "rune", "scroll", "clothing", "misc",
]
MagicSource = Literal["none", "rune", "scroll"]


class DamageSpec(BaseModel):
    dtype: DamageType
    base: NonNegativeInt = 0
    notes: str = ""


class BaseItem(BaseModel):
    model_config = ConfigDict(extra='forbid') # запретить лишние поля

    type: ItemType

    requiredTags: list[str] = Field(default_factory=list)
    keyTags: list[str] = Field(default_factory=list)

    # произвольные ярлыки
    tags: list[str] = Field(default_factory=list)


# ---- Mixins as composition via inheritance ----

class WithMastery(BaseItem):
    masteryRules: MasteryRules = Field(default_factory=MasteryRules)


class NoMastery(BaseItem):
    # у consumable мастерства нет (и в данных его быть не должно)
    pass


class WithDefense(BaseItem):
    # “защита есть” — ты не показал схему защиты, поэтому оставляю каркасом.
    # поменяй на нужные поля (например defense: NonNegativeInt или dict)
    defense: NonNegativeInt = 0


class NoDefense(BaseItem):
    pass


class WithDamage(BaseItem):
    damage: list[DamageSpec] = Field(default_factory=list)


class NoDamage(BaseItem):
    pass


class WithMagic(BaseItem):
    # магия ТОЛЬКО у rune/scroll
    magic: MagicSource
    magicPayload: dict[str, Any] = Field(default_factory=dict)


class NoMagic(BaseItem):
    # у всех прочих магия отсутствует (в payload её быть не должно)
    pass


# ---- Concrete item models ----

class WeaponItem(WithMastery, WithDamage, WithDefense, NoMagic):
    type: Literal["weapon"] = "weapon"


class ShieldItem(WithMastery, WithDamage, WithDefense, NoMagic):
    type: Literal["shield"] = "shield"


class ArmorItem(WithMastery, NoDamage, WithDefense, NoMagic):
    type: Literal["armor"] = "armor"


class ClothingItem(WithMastery, NoDamage, WithDefense, NoMagic):
    type: Literal["clothing"] = "clothing"


class ToolItem(WithMastery, NoDamage, NoDefense, NoMagic):
    type: Literal["tool"] = "tool"


class MiscItem(WithMastery, NoDamage, NoDefense, NoMagic):
    type: Literal["misc"] = "misc"


class ConsumableItem(NoMastery, NoDamage, NoDefense, NoMagic):
    type: Literal["consumable"] = "consumable"


class RuneItem(WithMastery, WithDamage, NoDefense, WithMagic):
    type: Literal["rune"] = "rune"
    magic: Literal["rune"] = "rune"


class ScrollItem(WithMastery, WithDamage, NoDefense, WithMagic):
    type: Literal["scroll"] = "scroll"
    magic: Literal["scroll"] = "scroll"


# ---- Public union type ----
ItemData = Annotated[
    Union[
        WeaponItem,
        ShieldItem,
        ArmorItem,
        ClothingItem,
        ToolItem,
        ConsumableItem,
        RuneItem,
        ScrollItem,
        MiscItem,
    ],
    Field(discriminator="type"),
]
