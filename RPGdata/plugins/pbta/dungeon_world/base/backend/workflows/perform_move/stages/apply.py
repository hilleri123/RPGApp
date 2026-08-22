from __future__ import annotations

from typing import Any

from plugins.common.protocols import StageCtx
from plugins.common.protocols.workflow_stage import StageOutcome
from plugins.common.types import ActionParticipants, SubmitResult, Workflow

from ..engine import apply_resource_draft, make_dw_apply_patch
from ..helpers import actor_data_from_scene, codex_moves_map, collect_grant_templates, merge_session_patch, primary_move_id
from ..stage_store import DwStage
from ..types import PerformMoveContext, PerformMoveEntry


def _grant_templates_from_moves(c: PerformMoveContext, moves_map) -> list[dict[str, Any]]:
    return collect_grant_templates(c.entry, moves_map)


class PerformMoveApplyStage(DwStage):
    key = "perform_move.apply"

    def _clear_entry_slice(self, entry: PerformMoveEntry, wf: Workflow | None = None) -> None:
        for effect in entry.resolve.effects:
            effect.applied = False

    def validate_patch(self, wf: Workflow, ctx: StageCtx, raw: dict[str, Any]) -> StageOutcome:
        return StageOutcome.fail("", "Apply stage does not support patch")

    def validate_submit(self, wf: Workflow, ctx: StageCtx, raw: dict[str, Any]) -> StageOutcome:
        return StageOutcome.ok_data({})

    def submit(self, wf: Workflow, ctx: StageCtx, data: dict[str, Any]) -> SubmitResult:
        c = self._context(wf)

        moves_map = codex_moves_map(self.full_codex, actor_data_from_scene(c, ctx.scene))
        move_id = primary_move_id(c.entry)
        move = moves_map.get(move_id)

        patch: dict[str, list[dict]] = {}

        for draft in c.entry.resolve.resource_drafts:
            if draft.skipped:
                continue
            if not draft.confirmed:
                draft.confirmed = True
            draft_patch = apply_resource_draft(ctx, draft, moves_map)
            for key, items in draft_patch.items():
                patch.setdefault(key, []).extend(items)

        for effect in c.entry.resolve.effects:
            if effect.applied:
                continue
            src_move = moves_map.get(effect.source_move_id or move_id)
            effect_patch = make_dw_apply_patch(ctx, effect, src_move or move, c.entry)
            for key, items in effect_patch.items():
                patch.setdefault(key, []).extend(items)
            effect.applied = True

        wf.context = c.model_dump(mode="json")
        merged = merge_session_patch(wf, patch or None)
        wf.stageData = {
            **(wf.stageData or {}),
            "grantTemplates": _grant_templates_from_moves(c, moves_map),
        }

        return ctx.rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
            sessionPatch=merged,
        )

    def visibility(self, wf: Workflow, ctx: StageCtx, participants: ActionParticipants) -> list[str]:
        return self._gm_actor_helper_visibility(wf, ctx, participants)
