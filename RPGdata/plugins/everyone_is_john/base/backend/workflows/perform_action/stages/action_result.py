# plugins/everyone_is_john/perform_action/stages/action_result.py
from __future__ import annotations
from typing import Any
from plugins.common.types import Workflow, SubmitResult
from plugins.common.protocols import StageCtx, issue
from ..types import PerformActionContext


class ActionResultStage:
    key = "john.action.result"

    def submit(self, wf: Workflow, ctx: StageCtx, input_dict: dict[str, Any]) -> SubmitResult:
        if ctx.actor_user_id != ctx.participants.gmUserId:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants,
                                 participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("", "Only GM can confirm result")])

        return ctx.rb.result(ok=True, wf=wf, participants=ctx.participants,
                             participants_dict_fallback=ctx.participants_dict, issues=[])
