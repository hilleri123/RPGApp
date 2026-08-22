# plugins/everyone_is_john/perform_action/stages/action_gm_review.py
from __future__ import annotations
from typing import Any, Optional
from pydantic import BaseModel
from plugins.common.types import Workflow, SubmitResult
from plugins.common.protocols import StageCtx, issue
from ..types import PerformActionContext


class GmReviewInput(BaseModel):
    decision: str           # "approve" | "reject" | "return"
    dice_override: Optional[int] = None
    comment: Optional[str] = None


class ActionGmReviewStage:
    key = "john.action.gm_review"

    def submit(self, wf: Workflow, ctx: StageCtx, input_dict: dict[str, Any]) -> SubmitResult:
        if ctx.actor_user_id != ctx.participants.gmUserId:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants,
                                 participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("", "Only GM can review")])

        try:
            c = PerformActionContext.model_validate(wf.context or {})
        except Exception as e:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants,
                                 participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("context", str(e))])

        parsed = ctx.rb.parse_input(GmReviewInput, input_dict, wf, ctx)
        if isinstance(parsed, SubmitResult):
            return parsed

        if parsed.decision not in ("approve", "reject", "return"):
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants,
                                 participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("decision", "Must be approve/reject/return")])

        entry = c.entry
        entry.gm_comment = parsed.comment
        entry.gm_dice_override = parsed.dice_override

        if parsed.decision == "approve":
            entry.gm_approved = True
            wf.stageKey = "john.action.canvas"
        elif parsed.decision == "reject":
            entry.gm_approved = False
            wf.stageKey = "john.action.result"
            entry.success = False
        else:  # return
            entry.gm_approved = None
            wf.stageKey = "john.action.declare"

        c.entry = entry
        wf.context = c.model_dump(mode="json")
        return ctx.rb.result(ok=True, wf=wf, participants=ctx.participants,
                             participants_dict_fallback=ctx.participants_dict, issues=[])
