from __future__ import annotations

from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


FrontEntityType = Literal["npc", "story_beat", "item", "counter", "location"]
ScenarioTagKind = Literal["manual", "front"]


class ScenarioTagBase(BaseModel):
    key: str
    label: str
    description: Optional[str] = None
    color: Optional[str] = None
    kind: ScenarioTagKind = "manual"


class ScenarioTagCreate(ScenarioTagBase):
    pass


class ScenarioTagUpdate(BaseModel):
    key: Optional[str] = None
    label: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None


class ScenarioTagOut(ScenarioTagBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    scenario_id: UUID
    front_id: Optional[UUID] = None


class FrontMemberIn(BaseModel):
    entity_type: FrontEntityType
    entity_id: UUID


class FrontMemberOut(FrontMemberIn):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    front_id: UUID


class FrontWikiNoteIn(BaseModel):
    note_id: UUID
    sort_order: int = 0


class FrontWikiNoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    front_id: UUID
    note_id: UUID
    sort_order: int = 0
    note_name: Optional[str] = None


class FrontWikiTreeNode(BaseModel):
    note_id: UUID
    note_name: Optional[str] = None
    parent_note_id: Optional[UUID] = None
    sort_order: int = 0
    depth: int = 0
    implied: bool = False
    link_id: Optional[str] = None


class FrontBase(BaseModel):
    name: str
    description_for_master: Optional[str] = None
    color: str = "#7c3aed"
    icon_url: Optional[HttpUrl] = None


class FrontCreate(FrontBase):
    pass


class FrontUpdate(BaseModel):
    name: Optional[str] = None
    description_for_master: Optional[str] = None
    color: Optional[str] = None
    icon_url: Optional[HttpUrl] = None


class FrontOut(FrontBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    scenario_id: UUID
    tag_id: UUID
    tag_key: Optional[str] = None
    members: list[FrontMemberOut] = Field(default_factory=list)
    wiki_notes: list[FrontWikiNoteOut] = Field(default_factory=list)
    wiki_tree: list[FrontWikiTreeNode] = Field(default_factory=list)
    wiki_note_count: int = 0


class FrontListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    scenario_id: UUID
    name: str
    description_for_master: Optional[str] = None
    color: str
    icon_url: Optional[HttpUrl] = None
    tag_id: UUID
    tag_key: Optional[str] = None
    member_count: int = 0
    wiki_note_count: int = 0
