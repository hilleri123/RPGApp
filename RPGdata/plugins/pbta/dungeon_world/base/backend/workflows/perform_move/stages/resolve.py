from __future__ import annotations

from plugins.common.protocols import StageCtx
from plugins.common.protocols.workflow_stage import StageOutcome, issue
from plugins.common.types import ActionParticipants, SubmitResult, Workflow

from ..engine import resolve_dw_move_outcome
from ..helpers import (
    actor_data_from_scene,
    build_resource_drafts,
    codex_moves_map,
    collect_grant_templates,
)
from ..stage_store import DwStage
from ..types import PerformMoveEntry, ResolveState


class PerformMoveResolveStage(DwStage):
    key = "perform_move.resolve"

    def _clear_entry_slice(self, entry: PerformMoveEntry, wf: Workflow | None = None) -> None:
        entry.resolve = ResolveState()

    def validate_patch(self, wf: Workflow, ctx: StageCtx, raw: dict[str, Any]) -> StageOutcome:
        return StageOutcome.fail("", "Resolve stage does not support patch")

    def validate_submit(self, wf: Workflow, ctx: StageCtx, raw: dict[str, Any]) -> StageOutcome:
        return StageOutcome.ok_data({})

    def submit(self, wf: Workflow, ctx: StageCtx, data: dict[str, Any]) -> SubmitResult:
        def err(field: str, msg: str) -> SubmitResult:
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue(field, msg)],
            )

        try:
            c = self._context(wf)
        except Exception as e:
            return err("context", str(e))

        if not c.entry.moves:
            return err("moves", "No moves selected")

        moves_map = codex_moves_map(self.full_codex, actor_data_from_scene(c, ctx.scene))

        outcome = c.entry.roll.outcome or "any"
        if not c.entry.roll.required:
            outcome = "any"

        for move_ref in c.entry.moves:
            move = moves_map.get(move_ref.id)
            if move is None:
                return err("moves", f"Move not found: {move_ref.id}")

            effects, choices, logs = resolve_dw_move_outcome(move, outcome)

            for eff in effects:
                eff.source_move_id = move_ref.id
                eff.source_move_title = move_ref.title

            for ch in choices:
                ch.source_move_id = move_ref.id
                ch.source_move_title = move_ref.title

            c.entry.resolve.effects.extend(effects)
            c.entry.resolve.pending_choices.extend(choices)
            c.entry.resolve.log_lines.extend([f"[{move_ref.title}] {line}" for line in logs])

        c.entry.resolve.resource_drafts = build_resource_drafts(c.entry, moves_map, outcome)

        wf.context = c.model_dump(mode="json")
        wf.stageData = {
            **(wf.stageData or {}),
            "grantTemplates": collect_grant_templates(c.entry, moves_map),
        }

        return ctx.rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
        )

    def visibility(self, wf: Workflow, ctx: StageCtx, participants: ActionParticipants) -> list[str]:
        return self._gm_actor_helper_visibility(wf, ctx, participants)
