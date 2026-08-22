from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class LaunchedScenarioOut(BaseModel):
    id: UUID
    name: str
    source_scenario_id: Optional[UUID] = None
    lifecycle_status: Optional[str] = None
    launch_mode: Optional[str] = None
    created: Optional[datetime] = None
    active_approach_session_id: Optional[UUID] = None

    model_config = {"from_attributes": True}


class ScenarioPartyOut(BaseModel):
    id: UUID
    launched_scenario_id: UUID
    name: str
    filter_tags: List[str] = Field(default_factory=list)
    sort_order: int = 0

    model_config = {"from_attributes": True}


class ScenarioPartyCreate(BaseModel):
    name: str
    filter_tags: List[str] = Field(default_factory=list)
    sort_order: int = 0


class LaunchScenarioIn(BaseModel):
    prep_scenario_id: UUID
    name: Optional[str] = None
    launch_mode: str = "multi_party"


class StartApproachIn(BaseModel):
    launched_scenario_id: UUID
    party_id: Optional[UUID] = None
    lobby_id: Optional[str] = None


class CloseLaunchedScenarioIn(BaseModel):
    launched_scenario_id: UUID
