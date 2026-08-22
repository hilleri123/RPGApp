from __future__ import annotations

from typing import Any, Literal, Optional
from uuid import UUID

from ...types import Skill

from pydantic import BaseModel, Field


OutcomeKind = Literal["hit_10_plus", "hit_7_9", "miss_6_minus", "hit", "any"]
ActorKind = Literal["character", "npc"]
TargetKind = Literal["character", "npc", "none"]


class AidState(BaseModel):
    requested: bool = False
    helper_user_id: Optional[UUID] = None
    helper_character_id: Optional[UUID] = None
    accepted: Optional[bool] = None
    bonus_amount: int = 0
    note: str = ""


class MoveRef(BaseModel):
    id: str = ""
    title: str = ""
    kind: str = ""


class RollState(BaseModel):
    required: bool = True
    stat_id: str = ""
    stat_value: int = 0
    base_modifier: int = 0
    local_bonus: int = 0
    aid_bonus: int = 0
    temp_bonus_ids: list[str] = Field(default_factory=list)

    roll_seed: str = ""
    dice: list[int] = Field(default_factory=list)
    total: int = 0
    outcome: Optional[OutcomeKind] = None
    result_text: str = ""


class ChoiceOption(BaseModel):
    id: str
    label: str
    payload: dict[str, Any] = Field(default_factory=dict)


class PendingChoice(BaseModel):
    id: str
    kind: Literal["player_choice", "gm_choice", "question_list", "target_choice"]
    prompt: str = ""
    choose: int = 1
    options: list[ChoiceOption] = Field(default_factory=list)
    resolved_option_ids: list[str] = Field(default_factory=list)
    resolved: bool = False
    source_move_id: str = ""
    source_move_title: str = ""

class EffectRecord(BaseModel):
    kind: str
    payload: dict[str, Any] = Field(default_factory=dict)
    applied: bool = False
    text: str = ""
    source_move_id: str = ""
    source_move_title: str = ""


class PerformMoveEntry(BaseModel):
    actor_user_id: UUID
    actor_kind: ActorKind = "character"

    actor_character_id: Optional[UUID] = None
    actor_npc_id: Optional[UUID] = None

    target_kind: TargetKind = "none"
    target_character_id: Optional[UUID] = None
    target_npc_id: Optional[UUID] = None

    moves: list[MoveRef] = Field(default_factory=list)
    roll: RollState = Field(default_factory=RollState)
    aid: AidState = Field(default_factory=AidState)

    pending_choices: list[PendingChoice] = Field(default_factory=list)
    effects: list[EffectRecord] = Field(default_factory=list)
    log_lines: list[str] = Field(default_factory=list)

    skills: list[Skill] = Field(default_factory=list)


class PerformMoveContext(BaseModel):
    scene_id: UUID
    entry: PerformMoveEntry