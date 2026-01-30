from __future__ import annotations

from typing import Any

from pydantic import ValidationError

from ..action_participants import ActionParticipants
from .types import Workflow, StageEnvelope, SubmitResult
from .stage_base import ResultBuilder, StageCtx, _issue
from .stages.choose_action import ChooseActionStage
from .stages.gm_set_position_effect import GmSetPositionEffectStage
from .stages.player_add_mods import PlayerAddModsStage
from .stages.assist_confirm import AssistConfirmStage
from .stages.gm_finalize import GmFinalizeStage
from .stages.prerollconfirm import PreRollConfirmStage
from .stages.mitigate import MitigateStage
from .stages.resist import ResistStage
from .stages.wrap_up import WrapUpStage



def _dump(m: Any) -> Any:
    return m.model_dump(mode="json") if hasattr(m, "model_dump") else m.dict()

class RollActionWorkflow:
    key = "blades.roll_action"

    def __init__(self):
        self._stages = {
            "choose_action": ChooseActionStage(),
            "gm_set_position_effect": GmSetPositionEffectStage(),
            "player_add_mods": PlayerAddModsStage(),
            "assist_confirm": AssistConfirmStage(),
            "gm_finalize": GmFinalizeStage(),
            "prerollconfirm": PreRollConfirmStage(),
            "mitigate": MitigateStage(),
            "resist": ResistStage(),
            "wrap_up": WrapUpStage(),
        }
        self._rb = ResultBuilder(self._visible_ids, self._participants_fallback_ids)

    def _participants_fallback_ids(self, participants_dict: dict[str, Any]) -> list[str]:
        out: list[str] = []
        gm = (participants_dict or {}).get("gmUserId")
        ini = (participants_dict or {}).get("initiatorUserId")
        if gm:
            out.append(str(gm))
        if ini and str(ini) not in out:
            out.append(str(ini))
        return out

    def _visible_ids(self, participants: ActionParticipants, wf: Workflow) -> list[str]:
        gm = str(participants.gmUserId)
        ini = str(participants.initiatorUserId)

        if wf.stageKey in ("choose_action", "player_add_mods", "prerollconfirm", "mitigate"):
            return [ini]
        if wf.stageKey in ("gm_set_position_effect", "gm_finalize", "resist", "wrap_up"):
            return [gm]
        if wf.stageKey == "assist_confirm":
            helper = (wf.context.get("mods") or {}).get("helper_user_id")
            return [str(helper)] if helper else [gm]
        if wf.stageKey == "done":
            return [gm, ini] if gm != ini else [gm]
        return [gm]

    def start(self, payload: dict[str, Any]) -> SubmitResult:
        wf = Workflow()
        wf.stageKey = "choose_action"
        wf.context = {
            "character_id": None,
            "selectedAction": None,
            "item_id": None,
            "position": None,
            "effect": None,
            "consequence_hint": None,
            "mods": {
                "push": False,
                "help": False,
                "helper_user_id": None,
                "help_confirmed": False,
                "devils_bargain": False,
                "bonus_dice": 0,
            },
            "roll": None,
            "roll_broadcasts": [],
            "consequences": None,
            "resist": None,
            "resist_broadcasts": [],
            "summary": None,
            "trauma": None,
            "stressEvents": [],
            "needsTrauma": False,
            "traumaCharacterId": None,
        }

        initiatorId = payload.get("participants", {}).get("initiatorUserId", None)
        participant_ids = [initiatorId] if initiatorId else []
        return SubmitResult(ok=True, issues=[], workflow=_dump(wf), participantIds=participant_ids)

    def present(self, scene: dict[str, Any], actor_user_id: str, participants_dict: dict[str, Any], wf_dict: dict[str, Any]) -> StageEnvelope:
        wf = Workflow.model_validate(wf_dict) if hasattr(Workflow, "model_validate") else Workflow.parse_obj(wf_dict)
        participants = ActionParticipants.model_validate(participants_dict) if hasattr(ActionParticipants, "model_validate") else ActionParticipants.parse_obj(participants_dict)

        stage = self._stages.get(wf.stageKey)
        if not stage:
            return StageEnvelope(audience=[{"kind": "all"}], stageKey="done", stageData={}, ui=None, broadcasts=[])

        ctx = StageCtx(scene=scene, actor_user_id=actor_user_id, participants=participants, participants_dict=participants_dict, rb=self._rb)
        return stage.present(wf, ctx)

    def submit(self, scene: dict[str, Any], actor_user_id: str, participants_dict: dict[str, Any], wf_dict: dict[str, Any], input_dict: dict[str, Any]) -> SubmitResult:
        try:
            wf = Workflow.model_validate(wf_dict) if hasattr(Workflow, "model_validate") else Workflow.parse_obj(wf_dict)
        except ValidationError as e:
            return self._rb.result(ok=False, wf=None, participants=None, participants_dict_fallback=participants_dict, issues=[_issue("workflow", str(e))])

        try:
            participants = ActionParticipants.model_validate(participants_dict) if hasattr(ActionParticipants, "model_validate") else ActionParticipants.parse_obj(participants_dict)
        except ValidationError as e:
            return self._rb.result(ok=False, wf=wf, participants=None, participants_dict_fallback=participants_dict, issues=[_issue("participants", str(e))])

        if wf.status != "active":
            return self._rb.result(ok=False, wf=wf, participants=participants, participants_dict_fallback=participants_dict, issues=[_issue("", "Workflow is not active")])

        stage = self._stages.get(wf.stageKey)
        if not stage:
            return self._rb.result(ok=False, wf=wf, participants=participants, participants_dict_fallback=participants_dict, issues=[_issue("", "Unknown stage")])

        ctx = StageCtx(scene=scene, actor_user_id=actor_user_id, participants=participants, participants_dict=participants_dict, rb=self._rb)
        return stage.submit(wf, ctx, input_dict)
