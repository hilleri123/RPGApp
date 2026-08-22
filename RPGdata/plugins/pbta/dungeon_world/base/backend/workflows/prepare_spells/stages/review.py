from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from plugins.common.protocols import StageCtx, BaseStage, issue
from plugins.common.types import SubmitResult, Workflow

from ...perform_move.helpers import apply_spellcasting_prepare
from ..types import PrepareSpellsContext


class ReviewInput(BaseModel):
    decision: str  # approve | reject
    comment: str = ""
    prepared_draft: list[dict[str, Any]] | None = None


class PrepareSpellsReviewStage(BaseStage):
    key = "prepare_spells.review"

    def __init__(self, full_codex):
        super().__init__(full_codex)

    def submit(self, wf: Workflow, ctx: StageCtx, input_dict: dict[str, Any]) -> SubmitResult:
        if str(ctx.actor_user_id) != str(ctx.participants.gmUserId):
            return ctx.rb.result(
                ok=False, wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("", "Only GM can approve preparation")],
            )

        try:
            c = PrepareSpellsContext.model_validate(wf.context or {})
        except Exception as e:
            return ctx.rb.result(
                ok=False, wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("context", str(e))],
            )

        parsed = ReviewInput.model_validate(input_dict or {})
        if parsed.decision not in ("approve", "reject"):
            return ctx.rb.result(
                ok=False, wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("decision", "decision must be approve or reject")],
            )

        if parsed.prepared_draft is not None:
            c.entry.prepared_draft = list(parsed.prepared_draft)
        c.entry.decision = parsed.decision
        c.entry.comment = parsed.comment or ""
        wf.context = c.model_dump(mode="json")

        session_patch: dict = {}
        if parsed.decision == "approve":
            ch = next(
                (x for x in (ctx.scene.characters or []) if str(x.id) == str(c.entry.character_id)),
                None,
            )
            if ch and isinstance(ch.data, dict):
                updated = apply_spellcasting_prepare(ch.data, c.entry.prepared_draft)
                session_patch = {
                    "characters": [{"id": str(c.entry.character_id), "dataPatch": updated}],
                }
            wf.stageKey = "completed"
            wf.status = "completed"
        else:
            wf.stageKey = "prepare_spells.draft"
            wf.status = "active"

        return ctx.rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
            sessionPatch=session_patch or None,
        )
