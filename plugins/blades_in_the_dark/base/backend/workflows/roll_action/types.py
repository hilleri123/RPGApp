from __future__ import annotations

from typing import Any, Literal, Optional
from pydantic import BaseModel, Field

ActionId = Literal[
    "hunt", "study", "survey", "tinker",
    "finesse", "prowl", "skirmish", "wreck",
    "attune", "command", "consort", "sway",
]

Position = Literal["controlled", "risky", "desperate"]
Effect = Literal["limited", "standard", "great"]

AttributeId = Literal["insight", "prowess", "resolve"]

ACTION_TO_ATTRIBUTE: dict[ActionId, AttributeId] = {
    "hunt": "insight", "study": "insight", "survey": "insight", "tinker": "insight",
    "finesse": "prowess", "prowl": "prowess", "skirmish": "prowess", "wreck": "prowess",
    "attune": "resolve", "command": "resolve", "consort": "resolve", "sway": "resolve",
}

Outcome = Literal["bad", "mixed", "good", "crit"]

StageKey = Literal[
    # 1) игрок объявляет action + персонажа
    "choose_action",

    # 2) мастер задаёт position/effect и набрасывает потенциальные последствия
    "gm_set_position_effect",

    # 3) игрок добавляет модификаторы (push/help/devils bargain)
    "player_add_mods",

    # 4) игрок, которого попросили помочь соглашается
    "assist_confirm",

    # 5) мастер финализирует (разрешить/запретить/поправить)
    "gm_finalize",

    # 6) бросок
    "prerollconfirm",

    # 7) если есть последствия — выбор смягчения
    "mitigate",

    # 8) бросок сопротивления (если выбрано)
    "resist",

    # 9-10) мастер фиксит травму/итог (или просто финалим)
    "wrap_up",

    "done",
]


class Workflow(BaseModel):
    actionKey: Literal["blades.roll_action"] = "blades.roll_action"
    stageKey: StageKey = "choose_action"
    stageData: dict[str, Any] = Field(default_factory=dict)
    context: dict[str, Any] = Field(default_factory=dict)
    status: Literal["active", "completed", "canceled"] = "active"


class UiSpec(BaseModel):
    component: str
    props: dict[str, Any] = Field(default_factory=dict)


class StageEnvelope(BaseModel):
    audience: list[dict[str, Any]]
    stageKey: StageKey
    stageData: dict[str, Any] = Field(default_factory=dict)
    ui: Optional[UiSpec] = None
    broadcasts: list[dict[str, Any]] = Field(default_factory=list)


class SubmitResult(BaseModel):
    ok: bool
    issues: list[dict[str, Any]] = Field(default_factory=list)
    workflow: Optional[dict[str, Any]] = None
    next: Optional[dict[str, Any]] = None
    broadcasts: list[dict[str, Any]] = Field(default_factory=list)

    participants: Optional[dict[str, Any]] = None

    # NEW: изменения сессии (выполняет SessionActionManager)
    sessionPatch: Optional[dict[str, Any]] = None


# -------- inputs

class ChooseActionInput(BaseModel):
    character_id: str
    action: ActionId
    item_id: Optional[str] = None


class GmSetInput(BaseModel):
    position: Position
    effect: Effect
    consequence_hint: Optional[str] = None


class PlayerModsInput(BaseModel):
    push: bool = False
    devils_bargain: bool = False
    bonus_dice: int = 0
    # help можно сделать позже: assist_from_user_id, или просто help:bool
    help: bool = False
    helper_user_id: Optional[str] = None

class AssistConfirmInput(BaseModel):
    accept_help: bool

class GmFinalizeInput(BaseModel):
    allow: bool = True
    # разрешаем мастеру править (опционально)
    action: Optional[ActionId] = None 
    item_id: Optional[str] = None 
    
    position: Optional[Position] = None
    effect: Optional[Effect] = None
    consequence_hint: Optional[str] = None


class PreRollConfirmInput(BaseModel):
    choice: Literal["resist", "accept"] = "accept"

class MitigateInput(BaseModel):
    choice: Literal["resist", "accept"] = "accept"


class ResistInput(BaseModel):
    attribute: AttributeId
    confirm: bool = True


class WrapUpInput(BaseModel):
    # если хочешь дать мастеру возможность вбить травму/итог
    trauma: Optional[str] = None
    summary: Optional[str] = None
