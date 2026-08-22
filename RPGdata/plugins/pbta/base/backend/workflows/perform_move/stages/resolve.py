from __future__ import annotations

from typing import Any

from plugins.common.protocols import BaseStage, StageCtx, issue
from plugins.common.types import SubmitResult, Workflow

from ..engine import resolve_move_outcome
from ..types import PerformMoveContext


class PerformMoveResolveStage(BaseStage):
    key = "perform_move.resolve"

    def submit(self, wf: Workflow, ctx: StageCtx, input_dict: dict[str, Any]) -> SubmitResult:
        def err(field: str, msg: str) -> SubmitResult:
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue(field, msg)],
            )

        try:
            c = PerformMoveContext.model_validate(wf.context or {})
        except Exception as e:
            return err("context", str(e))

        if not c.entry.moves:
            return err("moves", "No moves selected")

        moves_map = {
            **self.full_codex.playbooks.playbook_moves_map(),
            **self.full_codex.moves.moves_map(),
        }

        outcome = c.entry.roll.outcome or "any"
        if not c.entry.roll.required:
            outcome = "any"

        for move_ref in c.entry.moves:
            move = moves_map.get(move_ref.id)
            if move is None:
                return err("moves", f"Move not found: {move_ref.id}")

            effects, choices, logs = resolve_move_outcome(move, outcome)

            for eff in effects:
                if hasattr(eff, "source_move_id"):
                    eff.source_move_id = move_ref.id
                if hasattr(eff, "source_move_title"):
                    eff.source_move_title = move_ref.title

            for ch in choices:
                if hasattr(ch, "source_move_id"):
                    ch.source_move_id = move_ref.id
                if hasattr(ch, "source_move_title"):
                    ch.source_move_title = move_ref.title

            c.entry.effects.extend(effects)
            c.entry.pending_choices.extend(choices)
            c.entry.log_lines.extend(
                [f"[{move_ref.title}] {line}" for line in logs]
            )

        wf.context = c.model_dump(mode="json")
        wf.stageKey = "perform_move.choose" if c.entry.pending_choices else "perform_move.apply"

        return ctx.rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
        )