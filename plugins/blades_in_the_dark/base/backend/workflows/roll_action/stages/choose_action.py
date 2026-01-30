from __future__ import annotations

from ..types import ACTION_TO_ATTRIBUTE, StageEnvelope, UiSpec, ChooseActionInput
from ..scene import find_character_ref
from ..stage_base import BaseStage, StageCtx, _issue


class ChooseActionStage(BaseStage):
    key = "choose_action"

    def present(self, wf, ctx: StageCtx) -> StageEnvelope:
        return StageEnvelope(
            audience=[{"kind": "initiator"}],
            stageKey=wf.stageKey,
            stageData=wf.stageData,
            ui=UiSpec(
                component="blades.RollAction.ChooseAction",
                props={
                    "actions": list(ACTION_TO_ATTRIBUTE.keys()),
                    "actionGroups": [
                        {"key": "insight", "name": "Insight", "color": "#60a5fa", "actions": ["hunt", "study", "survey", "tinker"]},
                        {"key": "prowess", "name": "Prowess", "color": "#34d399", "actions": ["finesse", "prowl", "skirmish", "wreck"]},
                        {"key": "resolve", "name": "Resolve", "color": "#f472b6", "actions": ["attune", "command", "consort", "sway"]},
                    ],
                },
            ),
        )

    def submit(self, wf, ctx: StageCtx, input_dict):
        if not ctx.participants.has(ctx.actor_user_id, "initiator"):
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict,
                                 issues=[_issue("", "Only initiator can choose action")])

        parsed = ctx.rb.parse_input(ChooseActionInput, input_dict, ctx.rb, wf, ctx)
        if not isinstance(parsed, ChooseActionInput):
            return parsed

        ch_ref = find_character_ref(ctx.scene, parsed.character_id)
        if not ch_ref:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict,
                                 issues=[_issue("input.character_id", "Character not found in scene")])

        wf.context["character_id"] = parsed.character_id
        wf.context["selectedAction"] = parsed.action
        wf.context["item_id"] = parsed.item_id

        wf.context["position"] = None
        wf.context["effect"] = None
        wf.context["consequence_hint"] = None

        wf.context["mods"] = {
            "push": False,
            "help": False,
            "helper_user_id": None,
            "help_confirmed": False,
            "devils_bargain": False,
            "bonus_dice": 0,
        }

        wf.context["roll"] = None
        wf.context["roll_broadcasts"] = []
        wf.context["resist"] = None
        wf.context["resist_broadcasts"] = []
        wf.context["summary"] = None
        wf.context["trauma"] = None

        wf.context["stressEvents"] = []
        wf.context["needsTrauma"] = False
        wf.context["traumaCharacterId"] = None

        wf.stageKey = "gm_set_position_effect"
        return ctx.rb.result(ok=True, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict)
