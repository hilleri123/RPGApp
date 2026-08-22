from __future__ import annotations

from typing import Any

from plugins.common.protocols import StageCtx, issue
from plugins.common.types import SubmitResult, Workflow

from ..types import FreeDiceContext

_RESULT_KEY = "common.free_dice_roll.result"


class FreeDiceResultStage:
    """Show roll outcome to the table; initiator/GM dismisses to complete."""

    key = _RESULT_KEY

    def __init__(self, full_codex) -> None:
        self.full_codex = full_codex

    def submit(self, wf: Workflow, ctx: StageCtx, inp: dict[str, Any]) -> SubmitResult:
        fc = FreeDiceContext.model_validate(wf.context or {})
        actor = str(ctx.actor_user_id)
        if actor != str(fc.actor_user_id) and actor != str(ctx.participants.gmUserId):
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("", "Only initiator or GM can close the result")],
            )

        wf.stageKey = "completed"
        wf.status = "completed"
        return ctx.rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
        )
