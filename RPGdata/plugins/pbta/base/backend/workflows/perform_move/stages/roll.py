from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from plugins.common.protocols import BaseStage, StageCtx, issue
from plugins.common.types import SubmitResult, Workflow

from ..helpers import attach_roll_stage_data, outcome_from_total, roll_2d6
from ..types import PerformMoveContext


class RollInput(BaseModel):
    roll_seed: str


class PerformMoveRollStage(BaseStage):
    key = "perform_move.roll"

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

        if ctx.actor_user_id not in (c.entry.actor_user_id, ctx.participants.gmUserId):
            return err("", "Only actor or GM can roll")

        if not c.entry.roll.required:
            return err("roll", "This move does not require a roll")

        parsed = ctx.rb.parse_input(RollInput, input_dict, wf, ctx)
        if isinstance(parsed, SubmitResult):
            return parsed

        dice, rolled = roll_2d6(parsed.roll_seed)
        total = (
            rolled
            + c.entry.roll.base_modifier
            + c.entry.roll.local_bonus
            + c.entry.roll.aid_bonus
        )
        outcome = outcome_from_total(total)

        c.entry.roll.roll_seed = parsed.roll_seed
        c.entry.roll.dice = dice
        c.entry.roll.total = total
        c.entry.roll.outcome = outcome

        if outcome == "hit_10_plus":
            c.entry.roll.result_text = (
                f"10+ hit: {dice[0]}+{dice[1]} "
                f"{c.entry.roll.base_modifier:+d} "
                f"{c.entry.roll.local_bonus:+d} "
                f"{c.entry.roll.aid_bonus:+d} = {total}"
            )
        elif outcome == "hit_7_9":
            c.entry.roll.result_text = (
                f"7-9 hit: {dice[0]}+{dice[1]} "
                f"{c.entry.roll.base_modifier:+d} "
                f"{c.entry.roll.local_bonus:+d} "
                f"{c.entry.roll.aid_bonus:+d} = {total}"
            )
        else:
            c.entry.roll.result_text = (
                f"6- miss: {dice[0]}+{dice[1]} "
                f"{c.entry.roll.base_modifier:+d} "
                f"{c.entry.roll.local_bonus:+d} "
                f"{c.entry.roll.aid_bonus:+d} = {total}"
            )

        wf.context = c.model_dump(mode="json")
        wf.stageKey = "perform_move.resolve"

        move_title = c.entry.moves[0].title if c.entry.moves else "Ход"
        log_events = [
            ctx.rb.log_roll(
                title=f"{move_title} · 2d6",
                dice=dice,
                total=total,
                outcome=outcome,
                seed=parsed.roll_seed,
                meta={"stat_id": c.entry.roll.stat_id},
            ),
            ctx.rb.log_text(c.entry.roll.result_text or "", tags=["roll"]),
        ]

        return ctx.rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
            logEvents=log_events,
        )