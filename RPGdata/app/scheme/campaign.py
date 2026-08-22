from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class CampaignScenarioLinkIn(BaseModel):
    scenario_id: UUID
    order_num: int = 0
    title_override: Optional[str] = None


class CampaignScenarioOut(BaseModel):
    id: UUID
    scenario_id: UUID
    order_num: int
    title_override: Optional[str] = None
    scenario_name: Optional[str] = None

    model_config = {"from_attributes": True}


class CampaignBase(BaseModel):
    name: str
    description: Optional[str] = None
    rule_id_str: Optional[str] = None


class CampaignCreate(CampaignBase):
    scenarios: List[CampaignScenarioLinkIn] = Field(default_factory=list)


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    rule_id_str: Optional[str] = None
    scenarios: Optional[List[CampaignScenarioLinkIn]] = None
    current_step_index: Optional[int] = None
    is_active: Optional[bool] = None


class CampaignOut(CampaignBase):
    id: UUID
    master_id: UUID
    current_step_index: int
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    scenarios: List[CampaignScenarioOut] = Field(default_factory=list)
    has_carryover: bool = False
    can_continue: bool = False
    prep_scenario_id: Optional[UUID] = None
    launched_scenario_id: Optional[UUID] = None

    model_config = {"from_attributes": True}


class CampaignStartSessionIn(BaseModel):
    lobby_id: Optional[str] = None
    step_index: Optional[int] = None


class CampaignContinueIn(BaseModel):
    forced: bool = False


class CampaignSessionFinishOut(BaseModel):
    ok: bool
    campaign_id: Optional[UUID] = None
    finished_step_index: Optional[int] = None
    next_step_index: Optional[int] = None
    has_next: bool = False
    carryover_saved: bool = False


class CampaignSessionHistoryItem(BaseModel):
    session_id: UUID
    session_name: str
    campaign_id: Optional[UUID] = None
    campaign_name: Optional[str] = None
    step_index: Optional[int] = None
    total_steps: Optional[int] = None
    created_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    role: str
    is_active: bool = False


class CampaignProfileOut(BaseModel):
    as_master: List[CampaignOut] = Field(default_factory=list)
    session_history: List[CampaignSessionHistoryItem] = Field(default_factory=list)
