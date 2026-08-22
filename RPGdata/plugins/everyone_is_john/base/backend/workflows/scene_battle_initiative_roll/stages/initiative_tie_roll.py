# .../stages/initiative_tie_roll.py
from __future__ import annotations
from typing import Any
from pydantic import BaseModel, ValidationError
from plugins.common.types import Workflow, SubmitResult
from plugins.common.protocols import StageCtx, issue
from ..types import InitiativeWorkflowContext


class TieRollInput(BaseModel):
    action: str  # "confirm" | "reroll"


class InitiativeTieRollStage:
    key = "initiative.tie_roll"

    def submit(self, wf: Workflow, ctx: StageCtx, input_dict: dict[str, Any]) -> SubmitResult:
        # только GM может подтвердить/перебросить
        if ctx.actor_user_id != ctx.participants.gmUserId:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants,
                                 participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("", "Only GM can confirm or reroll")])

        try:
            c = InitiativeWorkflowContext.model_validate(wf.context or {})
        except ValidationError as e:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants,
                                 participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("context", str(e))])

        parsed = ctx.rb.parse_input(TieRollInput, input_dict, wf, ctx)
        if isinstance(parsed, SubmitResult):
            return parsed

        if parsed.action == "reroll":
            # сбрасываем canvas/roll у tie-финалистов и возвращаемся на tie_canvas
            tie_set = set(str(x) for x in (c.tieEntityIds or []))
            for i, e in enumerate(c.order):
                if str(e.entityId) in tie_set:
                    e.canvas_seed = None
                    e.tieRolled = False
                    e.tieResult = None
                    c.order[i] = e
            # currentIndex на первого финалиста
            for i, e in enumerate(c.order):
                if str(e.entityId) in tie_set:
                    c.currentIndex = i
                    break
            wf.stageKey = "initiative.tie_canvas"
            wf.context = c.model_dump(mode="json")
            return ctx.rb.result(ok=True, wf=wf, participants=ctx.participants,
                                 participants_dict_fallback=ctx.participants_dict,
                                 issues=[])

        # action == "confirm" → оркестратор сам переведёт в result
        wf.context = c.model_dump(mode="json")
        return ctx.rb.result(ok=True, wf=wf, participants=ctx.participants,
                             participants_dict_fallback=ctx.participants_dict,
                             issues=[])
