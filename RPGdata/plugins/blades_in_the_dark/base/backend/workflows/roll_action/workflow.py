from __future__ import annotations

from typing import Any

from pydantic import ValidationError

from plugins.common.types import SceneContext, ActionContext, ActionRole, ActionInfo, Workflow, StageEnvelope, SubmitResult, ActionParticipants
from plugins.common.protocols import ResultBuilder, StageCtx, issue, dump
from .stages.choose_action import ChooseActionStage
from .stages.gm_set_position_effect import GmSetPositionEffectStage
from .stages.player_add_mods import PlayerAddModsStage
from .stages.assist_confirm import AssistConfirmStage
from .stages.gm_finalize import GmFinalizeStage
from .stages.prerollconfirm import PreRollConfirmStage
from .stages.mitigate import MitigateStage
from .stages.resist import ResistStage
from .stages.wrap_up import WrapUpStage

from ...types import SceneData



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



    def actions_for(self, scene: SceneContext, role: ActionRole) -> list[ActionInfo]:
        scene_data: SceneData = scene.data
        if hasattr(scene_data, "mode") and scene_data.mode != "travel":
            return []
        return [
            ActionInfo(
                key=self.key,
                title="Действие",
                roles=["gm", "player"],
                description="Выполнения действия",
            )
        ]


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
        if wf.stageKey == "completed":
            return [gm, ini] if gm != ini else [gm]
        return [gm]

    def start(self, payload: ActionContext) -> SubmitResult:
        wf = Workflow(stageKey="choose_action", actionKey="active")
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

        initiatorId = payload.participants.initiatorUserId
        participant_ids = [str(initiatorId)] if initiatorId else []
        return SubmitResult(ok=True, issues=[], workflow=dump(wf), participantIds=participant_ids)


    def submit(self, action_context: ActionContext) -> SubmitResult:
        wf = action_context.workflow

        participants_dict = action_context.participants.model_dump(mode="json")
        participants = ActionParticipants.model_validate(participants_dict)

        if wf.status != "active":
            return self._rb.result(
                ok=False,
                wf=wf,
                participants=participants,
                participants_dict_fallback=participants_dict,
                issues=[issue("", "Workflow is not active")],
            )

        stage = self._stages.get(wf.stageKey)
        if not stage:
            return self._rb.result(
                ok=False,
                wf=wf,
                participants=participants,
                participants_dict_fallback=participants_dict,
                issues=[issue("", "Unknown stage")],
            )
        
        ctx = StageCtx(
            scene=action_context.scene,
            actor_user_id=action_context.actorUserId,  # UUID
            participants=participants,
            participants_dict=action_context.participants.model_dump(mode="json"),
            rb=self._rb,
        )
        return stage.submit(action_context, ctx)
