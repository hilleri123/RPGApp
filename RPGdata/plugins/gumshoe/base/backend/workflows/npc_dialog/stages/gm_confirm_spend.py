# plugins/gumshoe/npc_dialog/stages/gm_confirm_spend.py
from __future__ import annotations
from typing import Any, Literal
from pydantic import BaseModel
from plugins.common.types import Workflow, SubmitResult
from plugins.common.protocols import StageCtx, BaseStage, issue
from ..types import DialogContext


class GmConfirmInput(BaseModel):
    decision: Literal["approve", "reject"]


class GmConfirmSpendStage(BaseStage):
    key = "gumshoe.npc_dialog.gm_confirm_spend"

    def __init__(self, full_codex): super().__init__(full_codex)

    def submit(self, wf: Workflow, ctx: StageCtx, input_dict: dict[str, Any]) -> SubmitResult:
        try:
            c = DialogContext.model_validate(wf.context or {})
        except Exception as e:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants,
                                 participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("context", str(e))])

        # Проверяем что это один из игроков-участников, а не ГМ
        actor = str(ctx.actor_user_id)
        player_ids = list(c.entry.player_user_ids) if c.entry else []
        if actor not in player_ids:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants,
                                 participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("", "Only participants can confirm spend")])

        parsed = ctx.rb.parse_input(GmConfirmInput, input_dict, wf, ctx)
        if isinstance(parsed, SubmitResult):
            return parsed

        entry = c.entry
        pending = next((r for r in reversed(entry.spend_records) if not r.confirmed), None)
        if pending is None:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants,
                                 participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("", "No pending spend")])

        if parsed.decision == "approve":
            pending.confirmed = True
        else:
            entry.spend_records = [r for r in entry.spend_records if r is not pending]

        c.entry = entry
        wf.context = c.model_dump(mode="json")
        wf.stageKey = "gumshoe.npc_dialog.dialog_loop"

        return ctx.rb.result(ok=True, wf=wf, participants=ctx.participants,
                             participants_dict_fallback=ctx.participants_dict, issues=[])