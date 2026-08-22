from __future__ import annotations
from typing import Any, Protocol, Literal, Optional, runtime_checkable
from pydantic import BaseModel, Field, NonNegativeInt

from .items import ItemData
from .passive import PassiveState
from .trait import Trait

# Треки дварфа
class Tracks(BaseModel):
    hp: NonNegativeInt = 0
    eq: NonNegativeInt = 0
    fat: NonNegativeInt = 0
    conc: NonNegativeInt = 0
    grudge: NonNegativeInt = 0

class TrackMax(BaseModel):
    hp: NonNegativeInt = 0
    eq: NonNegativeInt = 0
    fat: NonNegativeInt = 0
    conc: NonNegativeInt = 0
    grudge: NonNegativeInt = 0



# PC и NPC одинаковы: один и тот же CombatantData, различие только kind/лейблы в UI.
CombatantKind = Literal["pc", "npc"]

class CombatantData(BaseModel):
    kind: CombatantKind = "pc"

    # фиксированный словарь тэгов хранится в конфиге менеджера; тут — выбранные тэги персонажа
    tags: list[str] = Field(default_factory=list)

    traits: list[Trait] = Field(default_factory=list)

    tracks: Tracks = Field(default_factory=Tracks)
    trackMax: TrackMax = Field(default_factory=TrackMax)

    # действия в ход (ты просил "сколько у них действий и тд")
    # значения по умолчанию можно централизовать в config() менеджера
    economy: dict[str, int] = Field(default_factory=lambda: {
        "main": 1,
        "move": 1,
        "defense": 1,
    })

    # экипировка/пассивки (по id; сами сущности — в item/passive)
    items: list[str] = Field(default_factory=list)
    passives: list[PassiveState] = Field(default_factory=list)


class CharacterData(CombatantData):
    pass
