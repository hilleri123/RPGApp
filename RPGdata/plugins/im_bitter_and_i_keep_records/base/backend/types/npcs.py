# types.py (добавить)

from pydantic import BaseModel, Field, NonNegativeInt
from typing import Any, Literal

class NpcTracks(BaseModel):
    hp: NonNegativeInt = 0
    eq: NonNegativeInt = 0

class NpcTrackMax(BaseModel):
    hp: NonNegativeInt = 0
    eq: NonNegativeInt = 0

class NpcData(BaseModel):
    id: str = ""
    name: str = ""
    kind: Literal["npc"] = "npc"
    description: str = ""

    # тэги можно оставить: так NPC всё равно взаимодействует с системой допусков/инструментов
    tags: list[str] = Field(default_factory=list)

    tracks: NpcTracks = Field(default_factory=NpcTracks)
    trackMax: NpcTrackMax = Field(default_factory=NpcTrackMax)

    # экономика действий оставляем (NPC тоже в бою ходит)
    economy: dict[str, int] = Field(default_factory=lambda: {"main": 1, "move": 1, "defense": 1})

    items: list[str] = Field(default_factory=list)

    meta: dict[str, Any] = Field(default_factory=dict)
