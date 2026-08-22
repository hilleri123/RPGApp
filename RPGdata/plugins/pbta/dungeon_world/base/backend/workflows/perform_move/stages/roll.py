from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from plugins.common.protocols import StageCtx
from plugins.common.protocols.workflow_stage import StageOutcome, issue
from plugins.common.types import ActionParticipants, SubmitResult, Workflow
from plugins.pbta.base.backend.workflows.perform_move.helpers import (
    outcome_from_total,
)

from ..helpers import consume_bonuses_session_patch
from ..stage_store import DwStage


class RollInput(BaseModel):
    roll_seed: str


class PerformMoveRollStage(DwStage):
    key = "perform_move.roll"

    def _clear_entry_slice(self, entry: Any, wf: Workflow | None = None) -> None:
        entry.roll.roll_seed = ""
        entry.roll.dice = []
        entry.roll.total = 0
        entry.roll.outcome = None
        entry.roll.result_text = ""

    def validate_patch(self, wf: Workflow, ctx: StageCtx, raw: dict[str, Any]) -> StageOutcome:
        return StageOutcome.fail("", "Roll stage does not support patch")

    def assemble(self, wf: Workflow, ctx: StageCtx, entry: Any) -> None:
        data = self.get(wf)
        if not data or not data.get("roll_seed"):
            return
        dice = list(data.get("dice") or [])
        if len(dice) < 2:
            return
        entry.roll.roll_seed = str(data["roll_seed"])
        entry.roll.dice = dice
        entry.roll.total = int(data.get("total") or 0)
        outcome = data.get("outcome")
        entry.roll.outcome = outcome if outcome else None
        entry.roll.result_text = str(data.get("result_text") or "")

    def validate_submit(self, wf: Workflow, ctx: StageCtx, raw: dict[str, Any]) -> StageOutcome:
        try:
            c = self._context(wf)
        except Exception as e:
            return StageOutcome.fail("context", str(e))

        if not self._actor_or_gm(ctx, c):
            return StageOutcome.fail("", "Only actor or GM can roll")

        if not c.entry.roll.required:
            return StageOutcome.fail("roll", "This move does not require a roll")

        if len(c.entry.roll.dice or []) >= 2:
            return StageOutcome.fail("roll", "Roll is already frozen")

        parsed = ctx.rb.parse_input(RollInput, raw, wf, ctx)
        if isinstance(parsed, SubmitResult):
            return StageOutcome(ok=False, issues=parsed.issues)

        return StageOutcome.ok_data({"roll_seed": parsed.roll_seed})

    def submit(self, wf: Workflow, ctx: StageCtx, data: dict[str, Any]) -> SubmitResult:
        try:
            c = self._context(wf)
        except Exception as e:
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("context", str(e))],
            )

        seed = str(data.get("roll_seed") or "")
        from app.services.roll_service import RollSpec, commit_roll

        roll_result = commit_roll(seed, RollSpec(expression="2d6"))
        dice = list(roll_result.dice)
        rolled = int(roll_result.rolled_sum)
        total = (
            rolled
            + c.entry.roll.base_modifier
            + c.entry.roll.local_bonus
            + c.entry.roll.aid_bonus
        )
        outcome = outcome_from_total(total)

        if outcome == "hit_10_plus":
            result_text = (
                f"10+ hit: {dice[0]}+{dice[1]} "
                f"{c.entry.roll.base_modifier:+d} "
                f"{c.entry.roll.local_bonus:+d} "
                f"{c.entry.roll.aid_bonus:+d} = {total}"
            )
        elif outcome == "hit_7_9":
            result_text = (
                f"7-9 hit: {dice[0]}+{dice[1]} "
                f"{c.entry.roll.base_modifier:+d} "
                f"{c.entry.roll.local_bonus:+d} "
                f"{c.entry.roll.aid_bonus:+d} = {total}"
            )
        else:
            result_text = (
                f"6- miss: {dice[0]}+{dice[1]} "
                f"{c.entry.roll.base_modifier:+d} "
                f"{c.entry.roll.local_bonus:+d} "
                f"{c.entry.roll.aid_bonus:+d} = {total}"
            )

        bonus = int(c.entry.resource_bonus_total or 0)
        if bonus:
            total += bonus
            result_text = f"{result_text} (+{bonus} бонус ресурсов = {total})"

        c.entry.roll.roll_seed = seed
        c.entry.roll.dice = dice
        c.entry.roll.total = total
        c.entry.roll.outcome = outcome
        c.entry.roll.result_text = result_text.strip()
        if c.entry.cast_spell_entry_id:
            from ..helpers import default_unprepare_cast_spell

            c.entry.unprepare_cast_spell = default_unprepare_cast_spell(outcome)

        self.put(wf, {
            "roll_seed": seed,
            "dice": dice,
            "total": total,
            "outcome": outcome,
            "result_text": c.entry.roll.result_text,
        })

        patch = consume_bonuses_session_patch(
            ctx.scene,
            actor_kind=c.entry.actor_kind,
            actor_character_id=c.entry.actor_character_id,
            actor_npc_id=c.entry.actor_npc_id,
            bonus_ids=list(c.entry.roll.temp_bonus_ids or []),
            only_consume_on="roll",
        )

        wf.context = c.model_dump(mode="json")

        move_title = c.entry.moves[0].title if c.entry.moves else "Ход"
        log_events = [
            ctx.rb.log_roll(
                title=f"{move_title} · 2d6",
                dice=dice,
                total=total,
                outcome=outcome,
                seed=seed,
                meta={
                    "stat_id": c.entry.roll.stat_id,
                    "expression": "2d6",
                    "system_id": "pbta.dungeon_world",
                    "seed_hash": roll_result.seed_hash,
                    "character_id": c.entry.actor_character_id,
                },
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
            sessionPatch=patch or None,
        )

    def visibility(self, wf: Workflow, ctx: StageCtx, participants: ActionParticipants) -> list[str]:
        return self._gm_actor_helper_visibility(wf, ctx, participants)
