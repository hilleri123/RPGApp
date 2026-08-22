# plugins/gumshoe/attack/stages/attack_result.py
from __future__ import annotations
from typing import Any

from plugins.common.types import Workflow, SubmitResult
from plugins.common.protocols import StageCtx, BaseStage, issue
from ..types import AttackContext


class AttackResultStage(BaseStage):
    key = "gumshoe.attack.result"
    def __init__(self, full_codex):
        super().__init__(full_codex)

    def submit(self, wf: Workflow, ctx: StageCtx, input_dict: dict[str, Any]) -> SubmitResult:
        # пока ничего не подтверждаем, просто помечаем done, когда нажмёт GM
        if ctx.actor_user_id != ctx.participants.gmUserId:
            return ctx.rb.result(
                ok=False, wf=wf, participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("", "Only GM can close attack")],
            )

        try:
            c = AttackContext.model_validate(wf.context or {})
        except Exception as e:
            return ctx.rb.result(
                ok=False, wf=wf, participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("context", str(e))],
            )

        wf.stageKey = "completed"
        wf.status = "completed"

        c.entry.canvas_seed = ""
        c.entry.damage_seed = ""
        wf.context = c.model_dump()

        return ctx.rb.result(
            ok=True, wf=wf, participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
        )
