# types_scene_switch_phase.py
from __future__ import annotations

from typing import Any, Literal, Optional
from uuid import UUID
from pydantic import BaseModel, Field
from ...types import CombatPhase, SceneData


class PendingAction(BaseModel):
    id: str
    action: str
    meta: dict[str, Any] = Field(default_factory=dict)


class CombatPhaseSnapshot(BaseModel):
    currentPhase: CombatPhase
    initiativeOrder: list[str] = Field(default_factory=list)
    activeIndex: int = 0
    contactsCount: int = 0


class SceneSwitchPhaseContext(BaseModel):
    sceneId: UUID
    currentPhase: CombatPhase
    nextPhase: CombatPhase
    pending: list[PendingAction] = Field(default_factory=list)
    snapshot: CombatPhaseSnapshot
    sceneData: SceneData


class SceneSwitchPhaseConfirmInput(BaseModel):
    decision: Literal["confirm", "cancel"]
    force: bool = False
