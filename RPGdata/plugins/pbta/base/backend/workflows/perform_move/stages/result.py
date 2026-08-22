from __future__ import annotations

from typing import Any

from plugins.common.protocols import BaseStage, StageCtx
from plugins.common.types import SubmitResult, Workflow

from ..types import PerformMoveContext


class PerformMoveResultStage(BaseStage):
    key = "perform_move.result"

    def submit(self, wf: Workflow, ctx: StageCtx, input_dict: dict[str, Any]) -> SubmitResult:
        c = PerformMoveContext.model_validate(wf.context or {})

        patch = None
        if isinstance(wf.stageData, dict):
            patch = wf.stageData.get("sessionPatch")

        wf.stageKey = "completed"
        wf.status = "completed"

        return ctx.rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
            sessionPatch=patch,
        )