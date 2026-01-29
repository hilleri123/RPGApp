from __future__ import annotations

from typing import Any, Literal, Optional, TypedDict
import random

from pydantic import BaseModel, Field, ValidationError, NonNegativeInt

Role = Literal["gm", "initiator", "player"]

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

# ---- Workflow model (храним прямо в redis как dict) ----

StageKey = Literal[
    "choose_action",
    "gm_set_position_effect",
    "confirm_or_repick",
    "roll",
    "resist",     # опционально
    "done",
]

class Workflow(BaseModel):
    actionKey: Literal["blades.roll_action"] = "blades.roll_action"
    stageKey: StageKey = "choose_action"
    stageData: dict[str, Any] = Field(default_factory=dict)
    context: dict[str, Any] = Field(default_factory=dict)  # межстадийные данные
    status: Literal["active", "completed", "canceled"] = "active"

# ---- Envelope that server will route ----

class UiSpec(BaseModel):
    component: str
    props: dict[str, Any] = Field(default_factory=dict)

class StageEnvelope(BaseModel):
    audience: list[dict[str, Any]]          # семантические селекторы: {"kind":"gm"} / {"kind":"initiator"} ...
    stageKey: StageKey
    stageData: dict[str, Any] = Field(default_factory=dict)
    ui: Optional[UiSpec] = None
    broadcasts: list[dict[str, Any]] = Field(default_factory=list)

class SubmitResult(BaseModel):
    ok: bool
    issues: list[dict[str, Any]] = Field(default_factory=list)
    workflow: Optional[dict[str, Any]] = None
    next: Optional[dict[str, Any]] = None  # StageEnvelope as dict
    broadcasts: list[dict[str, Any]] = Field(default_factory=list)

# ---- Inputs per stage ----

class ChooseActionInput(BaseModel):
    action: ActionId

class GmSetInput(BaseModel):
    position: Position
    effect: Effect
    consequence_hint: Optional[str] = None  # текстом; позже сделаешь структурой

class ConfirmInput(BaseModel):
    accept: bool

class ResistInput(BaseModel):
    # позже можно добавить выбор атрибута/типа резистанса;
    # пока считаем что резистим по атрибуту выбранного action.
    confirm_resist: bool = True

# ---- Helpers ----

def best_and_crit(rolls: list[int]) -> tuple[int, bool]:
    best = max(rolls) if rolls else 0
    crit = rolls.count(6) >= 2
    return best, crit

def roll_d6(pool: int) -> list[int]:
    pool = max(0, int(pool))
    if pool <= 0:
        # RAW: 0 dice = roll 2d6 take lowest; оставим так. [file:17]
        r = [random.randint(1, 6), random.randint(1, 6)]
        return [min(r)]
    return [random.randint(1, 6) for _ in range(pool)]

def extract_initiator_character(scene: dict[str, Any]) -> dict[str, Any]:
    # МИНИМАЛЬНО: ожидаем что сервер кладёт в сцену "initiatorCharacter" уже данными
    # (без id, как ты и хочешь).
    ch = scene.get("initiatorCharacter")
    return ch if isinstance(ch, dict) else {}

def action_rating(character: dict[str, Any], action: ActionId) -> int:
    actions = character.get("actions") or {}
    try:
        v = int(actions.get(action, 0))
    except Exception:
        v = 0
    return max(0, v)

def attribute_rating(character: dict[str, Any], attr: AttributeId) -> int:
    # Attribute rating = number of actions in that attribute with rating > 0. [file:17]
    actions = character.get("actions") or {}
    cnt = 0
    for aid, a_attr in ACTION_TO_ATTRIBUTE.items():
        if a_attr != attr:
            continue
        try:
            v = int(actions.get(aid, 0))
        except Exception:
            v = 0
        if v > 0:
            cnt += 1
    return cnt

# ---- Workflow implementation ----

class RollActionWorkflow:
    key = "blades.roll_action"

    def start(self, scene: dict[str, Any]) -> Workflow:
        wf = Workflow()
        wf.context = {
            "selectedAction": None,
            "position": None,
            "effect": None,
            "consequence_hint": None,
            "roll": None,
            "resist": None,
        }
        return wf

    def present(self, scene: dict[str, Any], role: Role, wf_dict: dict[str, Any]) -> StageEnvelope:
        wf = Workflow.model_validate(wf_dict) if hasattr(Workflow, "model_validate") else Workflow.parse_obj(wf_dict)

        if wf.stageKey == "choose_action":
            return StageEnvelope(
                audience=[{"kind": "initiator"}],
                stageKey=wf.stageKey,
                stageData=wf.stageData,
                ui=UiSpec(
                    component="blades.RollAction.ChooseAction",
                    props={"actions": list(ACTION_TO_ATTRIBUTE.keys())},
                ),
            )

        if wf.stageKey == "gm_set_position_effect":
            # GM видит выбранный action и может выставить position/effect
            return StageEnvelope(
                audience=[{"kind": "gm"}],
                stageKey=wf.stageKey,
                stageData={
                    "selectedAction": wf.context.get("selectedAction"),
                },
                ui=UiSpec(
                    component="blades.RollAction.GmSetPositionEffect",
                    props={
                        "positions": ["controlled", "risky", "desperate"],
                        "effects": ["limited", "standard", "great"],
                    },
                ),
            )

        if wf.stageKey == "confirm_or_repick":
            return StageEnvelope(
                audience=[{"kind": "initiator"}],
                stageKey=wf.stageKey,
                stageData={
                    "selectedAction": wf.context.get("selectedAction"),
                    "position": wf.context.get("position"),
                    "effect": wf.context.get("effect"),
                    "consequence_hint": wf.context.get("consequence_hint"),
                },
                ui=UiSpec(
                    component="blades.RollAction.Confirm",
                    props={},
                ),
            )

        if wf.stageKey == "roll":
            # UI-экран можно показать инициатору, но бросок мы всё равно рассылаем всем через broadcasts
            return StageEnvelope(
                audience=[{"kind": "initiator"}],
                stageKey=wf.stageKey,
                stageData=wf.context.get("roll") or {},
                ui=UiSpec(component="blades.RollAction.RollResult", props={}),
                broadcasts=wf.context.get("roll_broadcasts") or [],
            )

        if wf.stageKey == "resist":
            return StageEnvelope(
                audience=[{"kind": "initiator"}],
                stageKey=wf.stageKey,
                stageData=wf.context.get("resist") or {},
                ui=UiSpec(component="blades.RollAction.Resist", props={}),
                broadcasts=wf.context.get("resist_broadcasts") or [],
            )

        return StageEnvelope(
            audience=[{"kind": "all"}],
            stageKey="done",
            stageData={},
            ui=None,
            broadcasts=[],
        )

    def submit(self, scene: dict[str, Any], role: Role, wf_dict: dict[str, Any], input_dict: dict[str, Any]) -> SubmitResult:
        try:
            wf = Workflow.model_validate(wf_dict) if hasattr(Workflow, "model_validate") else Workflow.parse_obj(wf_dict)
        except ValidationError as e:
            return SubmitResult(ok=False, issues=[{"path": "workflow", "message": str(e), "level": "error"}])

        # guard
        if wf.status != "active":
            return SubmitResult(ok=False, issues=[{"path": "", "message": "Workflow is not active", "level": "error"}])

        ch = extract_initiator_character(scene)

        # ---- stage handlers ----

        if wf.stageKey == "choose_action":
            if role != "initiator":
                return SubmitResult(ok=False, issues=[{"path": "", "message": "Only initiator can choose action", "level": "error"}])

            try:
                inp = ChooseActionInput.model_validate(input_dict) if hasattr(ChooseActionInput, "model_validate") else ChooseActionInput.parse_obj(input_dict)
            except ValidationError as e:
                return SubmitResult(ok=False, issues=[{"path": "data", "message": str(e), "level": "error"}])

            wf.context["selectedAction"] = inp.action
            wf.context["position"] = None
            wf.context["effect"] = None
            wf.context["consequence_hint"] = None
            wf.stageKey = "gm_set_position_effect"

            return SubmitResult(ok=True, workflow=wf.model_dump() if hasattr(wf, "model_dump") else wf.dict())

        if wf.stageKey == "gm_set_position_effect":
            if role != "gm":
                return SubmitResult(ok=False, issues=[{"path": "", "message": "Only GM can set position/effect", "level": "error"}])

            try:
                inp = GmSetInput.model_validate(input_dict) if hasattr(GmSetInput, "model_validate") else GmSetInput.parse_obj(input_dict)
            except ValidationError as e:
                return SubmitResult(ok=False, issues=[{"path": "data", "message": str(e), "level": "error"}])

            wf.context["position"] = inp.position
            wf.context["effect"] = inp.effect
            wf.context["consequence_hint"] = inp.consequence_hint
            wf.stageKey = "confirm_or_repick"

            return SubmitResult(ok=True, workflow=wf.model_dump() if hasattr(wf, "model_dump") else wf.dict())

        if wf.stageKey == "confirm_or_repick":
            if role != "initiator":
                return SubmitResult(ok=False, issues=[{"path": "", "message": "Only initiator can confirm", "level": "error"}])

            try:
                inp = ConfirmInput.model_validate(input_dict) if hasattr(ConfirmInput, "model_validate") else ConfirmInput.parse_obj(input_dict)
            except ValidationError as e:
                return SubmitResult(ok=False, issues=[{"path": "data", "message": str(e), "level": "error"}])

            if not inp.accept:
                # репик: снова выбор action
                wf.stageKey = "choose_action"
                return SubmitResult(ok=True, workflow=wf.model_dump() if hasattr(wf, "model_dump") else wf.dict())

            # accept -> roll stage (сразу делаем бросок здесь, чтобы результат был атомарный)
            action = wf.context.get("selectedAction")
            if action not in ACTION_TO_ATTRIBUTE:
                return SubmitResult(ok=False, issues=[{"path": "context.selectedAction", "message": "Action not selected", "level": "error"}])

            rating = action_rating(ch, action)
            rolls = roll_d6(rating)
            best, crit = best_and_crit(rolls)

            outcome: Literal["bad", "mixed", "good", "crit"] = "bad"
            if crit:
                outcome = "crit"
            elif best == 6:
                outcome = "good"
            elif best in (4, 5):
                outcome = "mixed"
            else:
                outcome = "bad"

            wf.context["roll"] = {
                "action": action,
                "pool": rating,
                "rolls": rolls,
                "best": best,
                "crit": crit,
                "outcome": outcome,
                "position": wf.context.get("position"),
                "effect": wf.context.get("effect"),
            }

            wf.context["roll_broadcasts"] = [
                {
                    "type": "dice.roll",
                    "subtype": "action",
                    "action": action,
                    "pool": rating,
                    "rolls": rolls,
                    "best": best,
                    "crit": crit,
                    "outcome": outcome,
                    "position": wf.context.get("position"),
                    "effect": wf.context.get("effect"),
                }
            ]

            # если провал (1-3) — идём в resist (минимально)
            wf.stageKey = "resist" if outcome == "bad" else "done"
            if wf.stageKey == "done":
                wf.status = "completed"

            return SubmitResult(
                ok=True,
                workflow=wf.model_dump() if hasattr(wf, "model_dump") else wf.dict(),
                broadcasts=wf.context.get("roll_broadcasts") or [],
            )

        if wf.stageKey == "resist":
            if role != "initiator":
                return SubmitResult(ok=False, issues=[{"path": "", "message": "Only initiator can resist", "level": "error"}])

            try:
                inp = ResistInput.model_validate(input_dict) if hasattr(ResistInput, "model_validate") else ResistInput.parse_obj(input_dict)
            except ValidationError as e:
                return SubmitResult(ok=False, issues=[{"path": "data", "message": str(e), "level": "error"}])

            if not inp.confirm_resist:
                wf.stageKey = "done"
                wf.status = "completed"
                return SubmitResult(ok=True, workflow=wf.model_dump() if hasattr(wf, "model_dump") else wf.dict())

            action = wf.context.get("selectedAction")
            if action not in ACTION_TO_ATTRIBUTE:
                return SubmitResult(ok=False, issues=[{"path": "context.selectedAction", "message": "Action not selected", "level": "error"}])

            attr = ACTION_TO_ATTRIBUTE[action]
            pool = attribute_rating(ch, attr)
            rolls = roll_d6(pool)
            best, crit = best_and_crit(rolls)

            # RAW: stress cost = 6 - highest die (0-dice already handled by roll_d6) [file:17]
            stress_cost = max(0, 6 - best)

            wf.context["resist"] = {
                "attribute": attr,
                "pool": pool,
                "rolls": rolls,
                "best": best,
                "stressCost": stress_cost,
            }
            wf.context["resist_broadcasts"] = [
                {
                    "type": "dice.roll",
                    "subtype": "resistance",
                    "attribute": attr,
                    "pool": pool,
                    "rolls": rolls,
                    "best": best,
                    "stressCost": stress_cost,
                }
            ]

            # Здесь мы пока не меняем персонажа (stress) — это будет “патчами” позже, когда подключишь сервис
            wf.stageKey = "done"
            wf.status = "completed"

            return SubmitResult(
                ok=True,
                workflow=wf.model_dump() if hasattr(wf, "model_dump") else wf.dict(),
                broadcasts=wf.context.get("resist_broadcasts") or [],
            )

        return SubmitResult(ok=False, issues=[{"path": "", "message": "Unknown stage", "level": "error"}])
