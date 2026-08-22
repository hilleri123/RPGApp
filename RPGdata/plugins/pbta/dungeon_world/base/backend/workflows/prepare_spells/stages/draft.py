from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from plugins.common.protocols import StageCtx, BaseStage, issue
from plugins.common.types import SubmitResult, Workflow

from ..types import PrepareSpellsContext


class DraftInput(BaseModel):
    prepared_draft: list[dict[str, Any]] = Field(default_factory=list)


class PrepareSpellsDraftStage(BaseStage):
    key = "prepare_spells.draft"

    def __init__(self, full_codex):
        super().__init__(full_codex)

    def submit(self, wf: Workflow, ctx: StageCtx, input_dict: dict[str, Any]) -> SubmitResult:
        try:
            c = PrepareSpellsContext.model_validate(wf.context or {})
        except Exception as e:
            return ctx.rb.result(
                ok=False, wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("context", str(e))],
            )

        uid = str(ctx.actor_user_id)
        if uid not in (str(c.entry.player_user_id), str(ctx.participants.gmUserId)):
            return ctx.rb.result(
                ok=False, wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("", "Only actor or GM can edit draft")],
            )

        parsed = DraftInput.model_validate(input_dict or {})
        c.entry.prepared_draft = list(parsed.prepared_draft or [])
        c.entry.decision = None
        c.entry.comment = ""
        wf.context = c.model_dump(mode="json")
        wf.stageKey = "prepare_spells.review"
        wf.status = "active"

        return ctx.rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
        )
