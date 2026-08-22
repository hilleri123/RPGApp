from __future__ import annotations

from typing import Any

from plugins.common.protocols import StageCtx
from plugins.common.protocols.workflow_stage import StageOutcome
from plugins.common.types import ActionParticipants, SubmitResult, Workflow

from ..stage_store import DwStage


class PerformMoveResultStage(DwStage):
    key = "perform_move.result"

    def _clear_entry_slice(self, entry: Any, wf: Workflow | None = None) -> None:
        pass

    def validate_patch(self, wf: Workflow, ctx: StageCtx, raw: dict[str, Any]) -> StageOutcome:
        return StageOutcome.fail("", "Result stage does not support patch")

    def validate_submit(self, wf: Workflow, ctx: StageCtx, raw: dict[str, Any]) -> StageOutcome:
        return StageOutcome.ok_data({})

    def submit(self, wf: Workflow, ctx: StageCtx, data: dict[str, Any]) -> SubmitResult:
        patch = None
        if isinstance(wf.stageData, dict):
            patch = wf.stageData.get("sessionPatch")

        return ctx.rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
            sessionPatch=patch,
        )

    def visibility(self, wf: Workflow, ctx: StageCtx, participants: ActionParticipants) -> list[str]:
        return self._gm_actor_helper_visibility(wf, ctx, participants)
