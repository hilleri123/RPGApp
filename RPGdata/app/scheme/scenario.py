from typing import Optional, List, Any
from pydantic import BaseModel, HttpUrl, Field
from uuid import UUID
from datetime import datetime

from app.scheme.notes import Counter, Note
from app.scheme.npc import NPC


from .auth import User
from .location import Location
from .character import PlayerCharacter
from .game_item import GameItem


class ScenarioBase(BaseModel):
    name: str
    data: dict[str, Any] = Field(default_factory=dict)
    intro: Optional[str] = None
    max_players: Optional[int] = None
    rule_id_str: Optional[str] = None
    user_id: Optional[UUID] = None

    scenario_starts_at: Optional[datetime] = None

    source_scenario_id: Optional[UUID] = None
    is_session_snapshot: bool = False

    icon_url: Optional[HttpUrl] = None

class ScenarioCreate(ScenarioBase):
    pass

class ScenarioDuplicateRequest(BaseModel):
    name: Optional[str] = None

class Scenario(ScenarioBase):
    id: UUID
    user: User

    permission: Optional[str] = None

    class Config:
        from_attributes = True 

class ScenarioCounts(BaseModel):
    locations: int = 0
    characters: int = 0
    npcs: int = 0
    items: int = 0
    notes: int = 0
    counters: int = 0
    story_beats: int = 0

class ScenarioWithCounts(Scenario):  # или ScenarioOut
    counts: ScenarioCounts

    template_set_id: Optional[UUID] = None
    linked_template_set_ids: List[UUID] = []
    linked_name_pack_ids: List[UUID] = []


class FullScenario(Scenario):
    id: UUID
    user: User
    locations: List[Location] = Field(default_factory=list)
    characters: List[PlayerCharacter] = Field(default_factory=list)
    npcs: List[NPC] = Field(default_factory=list)
    items: List[GameItem] = Field(default_factory=list)
    notes: List[Note] = Field(default_factory=list)
    counters: List[Counter] = Field(default_factory=list)
    # events: List[]

    class Config:
        from_attributes = True 

