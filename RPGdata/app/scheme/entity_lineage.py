from __future__ import annotations

from typing import Any, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class EntityLineageOut(BaseModel):
    entity_type: str
    prep_scenario_id: Optional[UUID] = None
    prep_scenario_name: Optional[str] = None
    launched_scenario_id: Optional[UUID] = None
    current_scenario_id: UUID
    current_entity_id: UUID
    current: dict[str, Any] = Field(default_factory=dict)
    prep: Optional[dict[str, Any]] = None
    prep_entity_id: Optional[UUID] = None
    has_prep_entity: bool = False


class EntityLineageSyncIn(BaseModel):
    entity_type: str
    entity_id: UUID
    direction: Literal["to_prep", "to_launched"]


class EntityLineagePatchIn(BaseModel):
    entity_type: str
    entity_id: UUID
    side: Literal["current", "prep"]
    fields: dict[str, Any] = Field(default_factory=dict)
