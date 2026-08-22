from __future__ import annotations

from typing import Any, Literal, Optional
from pydantic import BaseModel, Field

from .action_participants import ActionRole


class ActionInfo(BaseModel):
    key: str
    title: str
    roles: list[ActionRole] = Field(default_factory=list)
    description: str = ""


class Workflow(BaseModel):
    actionKey: str
    stageKey: str
    stageData: dict[str, Any] = Field(default_factory=dict)
    context: dict[str, Any] = Field(default_factory=dict)
    status: Literal["active", "completed", "canceled"] = "active"
    tags: list[str] = Field(default_factory=list)




class StageEnvelope(BaseModel):
    audience: list[dict[str, Any]]
    stageKey: str
    stageData: dict[str, Any] = Field(default_factory=dict)
    broadcasts: list[dict[str, Any]] = Field(default_factory=list)


class SubmitResult(BaseModel):
    ok: bool
    issues: list[dict[str, Any]] = Field(default_factory=list)
    workflow: Workflow
    next: Optional[dict[str, Any]] = None
    broadcasts: list[dict[str, Any]] = Field(default_factory=list)
    logEvents: list[dict[str, Any]] = Field(default_factory=list)

    participantIds: list[str] = Field(default_factory=list)

    # NEW: изменения сессии (выполняет SessionActionManager)
    sessionPatch: Optional[dict[str, Any]] = None
    can_close: bool = False

