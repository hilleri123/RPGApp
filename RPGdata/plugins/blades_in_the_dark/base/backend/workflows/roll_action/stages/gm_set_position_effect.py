from __future__ import annotations
from typing import Any

from ..types import GmSetInput
from plugins.common.protocols import BaseStage, StageCtx, issue
from plugins.common.types import Workflow, ActionContext


class GmSetPositionEffectStage(BaseStage):
    key = "gm_set_position_effect"


    def submit(self, action_context: ActionContext, ctx: StageCtx):
        wf = action_context.workflow
        input_dict = action_context.input or {}
        if not ctx.participants.has(ctx.actor_user_id, "gm"):
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("", "Only GM can set position/effect")])

        parsed = ctx.rb.parse_input(GmSetInput, input_dict, wf, ctx)
        if not isinstance(parsed, GmSetInput):
            return parsed

        wf.context["position"] = parsed.position
        wf.context["effect"] = parsed.effect
        wf.context["consequence_hint"] = parsed.consequence_hint or ""

        wf.stageKey = "player_add_mods"
        return ctx.rb.result(ok=True, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict)
