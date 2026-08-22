from __future__ import annotations
from typing import Any

from ..types import GmFinalizeInput
from plugins.common.protocols import BaseStage, StageCtx, issue
from plugins.common.types import Workflow, ActionContext


class GmFinalizeStage(BaseStage):
    key = "gm_finalize"

    def submit(self, action_context: ActionContext, ctx: StageCtx):
        wf = action_context.workflow
        input_dict = action_context.input or {}
        if not ctx.participants.has(ctx.actor_user_id, "gm"):
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("", "Only GM can finalize")])

        parsed = ctx.rb.parse_input(GmFinalizeInput, input_dict, wf, ctx)
        if not isinstance(parsed, GmFinalizeInput):
            return parsed

        if not parsed.allow:
            wf.stageKey = "choose_action"
            return ctx.rb.result(ok=True, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict)

        if parsed.action:
            wf.context["selectedAction"] = parsed.action
        if "item_id" in input_dict:
            wf.context["item_id"] = parsed.item_id

        if parsed.position:
            wf.context["position"] = parsed.position
        if parsed.effect:
            wf.context["effect"] = parsed.effect
        if parsed.consequence_hint is not None:
            wf.context["consequence_hint"] = parsed.consequence_hint

        wf.stageKey = "prerollconfirm"
        return ctx.rb.result(ok=True, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict)
