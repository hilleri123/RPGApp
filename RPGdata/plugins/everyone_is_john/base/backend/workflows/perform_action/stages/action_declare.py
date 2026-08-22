# plugins/everyone_is_john/perform_action/stages/action_declare.py
from __future__ import annotations
from typing import Any, Optional
from pydantic import BaseModel
from plugins.common.types import Workflow, SubmitResult
from plugins.common.protocols import StageCtx, issue
from ..types import PerformActionContext


class DeclareInput(BaseModel):
    description: Optional[str] = None
    spend_tokens: int = 0
    has_profession: bool = False


class ActionDeclareStage:
    key = "john.action.declare"

    def submit(self, wf: Workflow, ctx: StageCtx, input_dict: dict[str, Any]) -> SubmitResult:
        try:
            c = PerformActionContext.model_validate(wf.context or {})
        except Exception as e:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants,
                                 participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("context", str(e))])

        parsed = ctx.rb.parse_input(DeclareInput, input_dict, wf, ctx)
        if isinstance(parsed, SubmitResult):
            return parsed

        if c.entry is None:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants,
                                 participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("entry", "No entry in context")])

        # проверим жетоны
        entry = c.entry
        avail = entry.available_tokens

        entry.description = parsed.description
        entry.spend_tokens = parsed.spend_tokens
        entry.has_profession = parsed.has_profession

        wf.context = c.model_dump(mode="json")
        wf.stageKey = "john.action.gm_review"
        return ctx.rb.result(ok=True, wf=wf, participants=ctx.participants,
                             participants_dict_fallback=ctx.participants_dict, issues=[])
