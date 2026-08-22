from __future__ import annotations
from typing import Any

from ..types import MitigateInput
from plugins.common.protocols import BaseStage, StageCtx, issue
from plugins.common.types import Workflow, ActionContext


class MitigateStage(BaseStage):
    key = "mitigate"


    def submit(self, action_context: ActionContext, ctx: StageCtx):
        wf = action_context.workflow
        input_dict = action_context.input or {}
        if not ctx.participants.has(ctx.actor_user_id, "initiator"):
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("", "Only initiator can mitigate")])

        parsed = ctx.rb.parse_input(MitigateInput, input_dict, wf, ctx)
        if not isinstance(parsed, MitigateInput):
            return parsed

        wf.stageKey = "wrap_up" if parsed.choice == "accept" else "resist"
        return ctx.rb.result(ok=True, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict)
