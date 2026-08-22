from __future__ import annotations

from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from .common import Issue

_META_FIELDS = frozenset({"scenario_id", "type", "force", "data"})


class UniversalUpsertPayload(BaseModel):
    model_config = ConfigDict(extra="allow")

    scenario_id: UUID
    type: str
    force: bool = False
    data: Dict[str, Any] = Field(default_factory=dict)

    def entity_fields(self) -> Dict[str, Any]:
        return {
            k: v
            for k, v in self.model_dump(mode="json").items()
            if k not in _META_FIELDS
        }


class UniversalResult(BaseModel):
    ok: bool = True
    forced: bool = False
    issues: List[Issue] = Field(default_factory=list)
    data: Optional[Dict[str, Any]] = None
    entity: Optional[Dict[str, Any]] = None
