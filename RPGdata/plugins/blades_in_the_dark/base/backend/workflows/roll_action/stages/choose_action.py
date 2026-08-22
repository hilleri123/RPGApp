from __future__ import annotations
from typing import Any

from ..types import ACTION_TO_ATTRIBUTE, ChooseActionInput
from plugins.common.types import Workflow, ActionContext
from plugins.common.protocols import BaseStage, StageCtx, issue


class ChooseActionStage(BaseStage):
    key = "choose_action"

    def submit(self, action_context: ActionContext, ctx: StageCtx):
        wf = action_context.workflow
        input_dict = action_context.input or {}
        if not ctx.participants.has(ctx.actor_user_id, "initiator"):
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("", "Only initiator can choose action")])

        parsed = ctx.rb.parse_input(ChooseActionInput, input_dict, wf, ctx)
        if not isinstance(parsed, ChooseActionInput):
            return parsed

        ch_ref = next((c for c in ctx.scene.characters if c.id == parsed.character_id), None)
        if ch_ref is None:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("input.character_id", "Character not found in scene")])

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
