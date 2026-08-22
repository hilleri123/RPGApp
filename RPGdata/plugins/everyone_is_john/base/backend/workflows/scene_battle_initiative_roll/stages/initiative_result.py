from __future__ import annotations

from typing import Any

from pydantic import ValidationError

from plugins.common.types import Workflow, StageEnvelope, SubmitResult
from plugins.common.protocols import StageCtx, issue
from ..types import InitiativeWorkflowContext


class InitiativeResultStage:
    key = "initiative.result"


    def submit(self, wf: Workflow, ctx: StageCtx, input_dict: dict[str, Any]) -> SubmitResult:
        # На этой стадии submit должен работать только у GM
        if ctx.actor_user_id != ctx.participants.gmUserId:
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("", "Only GM can confirm initiative order")],
            )

        # Сам патч делается в workflow._finish (тут просто “разрешаем” завершить)
        return ctx.rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
        )
