# plugins/gumshoe/investigate_obstacle/stages/gm_confirm.py
from __future__ import annotations
from typing import Any, Literal, Optional
from pydantic import BaseModel
from plugins.common.types import Workflow, SubmitResult
from plugins.common.protocols import StageCtx, BaseStage, issue
from ..types import InvestigateContext


class GmConfirmInput(BaseModel):
    decision: Literal["approve", "reject"]
    comment: Optional[str] = None


class GmConfirmStage(BaseStage):
    key = "gumshoe.investigate.gm_confirm"
    def __init__(self, full_codex):
        super().__init__(full_codex)

    def submit(self, wf: Workflow, ctx: StageCtx, input_dict: dict[str, Any]) -> SubmitResult:
        if ctx.actor_user_id != ctx.participants.gmUserId:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants,
                                 participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("", "Only GM can confirm")])

        try:
            c = InvestigateContext.model_validate(wf.context or {})
        except Exception as e:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants,
                                 participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("context", str(e))])

        parsed = ctx.rb.parse_input(GmConfirmInput, input_dict, wf, ctx)
        if isinstance(parsed, SubmitResult):
            return parsed

        entry = c.entry

        # находим последнюю неподтверждённую запись
        pending = next(
            (r for r in reversed(entry.spend_records) if not r.confirmed),
            None
        )
        if pending is None:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants,
                                 participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("", "No pending spend")])

        if parsed.decision == "approve":
            pending.confirmed = True
            pending.revealed = True   # текст будет показан игроку в spend_loop
        else:
            # отклонено — убираем pending запись
            entry.spend_records = [r for r in entry.spend_records if r is not pending]

        c.entry = entry
        wf.context = c.model_dump(mode="json")
        try:
            # wf.tags.remove("hidden")
            pass
        except:
            pass
        wf.stageKey = "gumshoe.investigate.spend_loop"   # возврат в петлю

        return ctx.rb.result(ok=True, wf=wf, participants=ctx.participants,
                             participants_dict_fallback=ctx.participants_dict, issues=[])
