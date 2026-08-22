from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel, Field, NonNegativeInt

from .items import ItemData

ActionId = Literal[
    "hunt", "study", "survey", "tinker",
    "finesse", "prowl", "skirmish", "wreck",
    "attune", "command", "consort", "sway",
]
AttributeId = Literal["insight", "prowess", "resolve"]

TraumaId = Literal[
    "cold", "haunted", "obsessed", "paranoid",
    "reckless", "soft", "unstable", "vicious",
]

PlaybookId = Literal[
    "cutter",
    "hound",
    "leech",
    "lurk",
    "slide",
    "spider",
    "whisper",
]

LoadId = Literal["light", "normal", "heavy"]
LOAD_VALUE: dict[LoadId, int] = {"light": 3, "normal": 5, "heavy": 6}

class HarmTrack(BaseModel):
    # Level 3: 1 box
    l3: Optional[str] = None
    # Level 2: 2 boxes
    l2: list[Optional[str]] = Field(default_factory=lambda: [None, None])
    # Level 1: 2 boxes
    l1: list[Optional[str]] = Field(default_factory=lambda: [None, None])

class CharacterData(BaseModel):
    actions: dict[ActionId, NonNegativeInt] = Field(default_factory=dict)

    playbookId: Optional[PlaybookId] = None
    abilities: list[str] = Field(default_factory=list)
    
    stress: NonNegativeInt = 0
    traumas: list[TraumaId] = Field(default_factory=list)
    load: Optional[LoadId] = None

    harm: HarmTrack = Field(default_factory=HarmTrack)

    items: list[ItemData] = Field(default_factory=list)
