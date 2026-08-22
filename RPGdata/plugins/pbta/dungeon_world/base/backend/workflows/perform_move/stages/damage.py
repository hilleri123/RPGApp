from __future__ import annotations

from typing import Any

from plugins.common.protocols import StageCtx
from plugins.common.protocols.workflow_stage import StageOutcome
from plugins.common.types import ActionParticipants, SubmitResult, Workflow

from ..stage_store import DwStage


class PerformMoveDamageStage(DwStage):
    """Legacy alias stage — not in the main pipeline; kept for backward compatibility."""

    key = "perform_move.damage"

    def _clear_entry_slice(self, entry: Any, wf: Workflow | None = None) -> None:
        entry.damage_claims = []

    def validate_patch(self, wf: Workflow, ctx: StageCtx, raw: dict[str, Any]) -> StageOutcome:
        return StageOutcome.fail("", "Damage stage does not support patch")

    def validate_submit(self, wf: Workflow, ctx: StageCtx, raw: dict[str, Any]) -> StageOutcome:
        return StageOutcome.ok_data({})

    def submit(self, wf: Workflow, ctx: StageCtx, data: dict[str, Any]) -> SubmitResult:
        c = self._context(wf)

        if not c.entry.damage_claims:
            wf.context = c.model_dump(mode="json")
            return ctx.rb.result(
                ok=True,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[],
            )

        wf.context = c.model_dump(mode="json")
        return ctx.rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
        )

    def visibility(self, wf: Workflow, ctx: StageCtx, participants: ActionParticipants) -> list[str]:
        return self._gm_actor_helper_visibility(wf, ctx, participants)
