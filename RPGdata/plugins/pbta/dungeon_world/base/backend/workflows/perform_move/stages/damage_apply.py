from __future__ import annotations

from typing import Any

from plugins.common.protocols import StageCtx
from plugins.common.protocols.workflow_stage import StageOutcome, issue
from plugins.common.types import ActionParticipants, SubmitResult, Workflow

from ..engine import build_damage_hp_patches, roll_damage_claim
from ..helpers import merge_session_patch
from ..stage_store import DwStage
from ..types import PerformMoveEntry


class PerformMoveDamageApplyStage(DwStage):
    key = "perform_move.damage_apply"

    def _clear_entry_slice(self, entry: PerformMoveEntry, wf: Workflow | None = None) -> None:
        resolve = entry.resolve
        if wf is not None:
            data = self.get(wf)
            logs_from = int(data.get("logs_from") or 0)
            if logs_from and len(resolve.log_lines) > logs_from:
                resolve.log_lines = resolve.log_lines[:logs_from]
        for claim in entry.damage_claims:
            claim.applied = False

    def validate_patch(self, wf: Workflow, ctx: StageCtx, raw: dict[str, Any]) -> StageOutcome:
        return StageOutcome.fail("", "Damage apply stage does not support patch")

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

        patch: dict[str, list[dict]] = {}
        logs_from = len(c.entry.resolve.log_lines)

        for claim in c.entry.damage_claims:
            if claim.cancelled or claim.applied:
                continue

            roll_damage_claim(claim, ctx.scene)
            claim_patch = build_damage_hp_patches(ctx, claim)
            for key, items in claim_patch.items():
                patch.setdefault(key, []).extend(items)

            claim.applied = True
            if claim.hp_effect == "heal":
                c.entry.resolve.log_lines.append(
                    f"{claim.source_label} → {claim.target_label}: исцеление {claim.total_final}"
                )
            else:
                half_note = " (половина)" if claim.half_damage or claim.multiplier < 1 else ""
                counter_note = f" · контр-ход: {claim.counter_move_title}" if claim.counter_move_title else ""
                c.entry.resolve.log_lines.append(
                    f"{claim.source_label} → {claim.target_label}: "
                    f"{claim.total_raw} − броня {claim.armor_applied} × {claim.multiplier} = {claim.total_final}"
                    f"{half_note}{counter_note}"
                )

        self.put(wf, {"logs_from": logs_from})
        wf.context = c.model_dump(mode="json")
        merged = merge_session_patch(wf, patch or None)

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
