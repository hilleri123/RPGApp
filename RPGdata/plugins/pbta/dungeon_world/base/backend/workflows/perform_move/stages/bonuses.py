from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from plugins.common.protocols import StageCtx
from plugins.common.protocols.workflow_stage import StageOutcome, issue
from plugins.common.types import ActionParticipants, SubmitResult, Workflow

from ..helpers import list_consumable_bonuses, primary_move_id
from ..stage_store import DwStage
from ..types import PerformMoveContext


class BonusesInput(BaseModel):
    consume_bonus_ids: list[str] = Field(default_factory=list)
    resource_bonus_total: int = 0


class PerformMoveBonusesStage(DwStage):
    key = "perform_move.bonuses"

    def _clear_entry_slice(self, entry: Any, wf: Workflow | None = None) -> None:
        entry.roll.temp_bonus_ids = []
        entry.resource_bonus_total = 0

    def _available_bonuses(self, wf: Workflow, ctx: StageCtx, c: PerformMoveContext) -> list[dict]:
        actor = None
        if c.entry.actor_kind == "character" and c.entry.actor_character_id:
            actor = next(
                (x for x in (ctx.scene.characters or []) if str(x.id) == str(c.entry.actor_character_id)),
                None,
            )
        move_ids = [m.id for m in c.entry.moves]
        return list_consumable_bonuses(
            actor.data if actor and isinstance(actor.data, dict) else {},
            stat_id=c.entry.roll.stat_id or "",
            move_ids=move_ids,
        )

    def validate_patch(self, wf: Workflow, ctx: StageCtx, raw: dict[str, Any]) -> StageOutcome:
        cur = dict(self.get(wf))
        if "consume_bonus_ids" in raw:
            cur["consume_bonus_ids"] = list(raw["consume_bonus_ids"] or [])
        if "resource_bonus_total" in raw:
            cur["resource_bonus_total"] = int(raw["resource_bonus_total"] or 0)
        return StageOutcome.ok_data(cur)

    def apply_patch(self, wf: Workflow, ctx: StageCtx, data: dict[str, Any]) -> None:
        self.put(wf, data)

    def assemble(self, wf: Workflow, ctx: StageCtx, entry: Any) -> None:
        data = self.get(wf)
        if not data:
            return
        selected = list(data.get("consume_bonus_ids") or [])
        entry.roll.temp_bonus_ids = selected
        try:
            c = PerformMoveContext.model_validate(wf.context or {})
        except Exception:
            entry.resource_bonus_total = int(data.get("resource_bonus_total") or 0)
            return
        available = self._available_bonuses(wf, ctx, c)
        bonus_total = sum(
            int(b.get("amount") or 0)
            for b in available
            if b["id"] in selected and b.get("consume_on") == "roll"
        )
        entry.resource_bonus_total = bonus_total
        wf.stageData = {
            **(wf.stageData or {}),
            "bonusOptions": available,
            "selectedBonusIds": selected,
            "resourceBonusTotal": bonus_total,
        }

    def validate_submit(self, wf: Workflow, ctx: StageCtx, raw: dict[str, Any]) -> StageOutcome:
        try:
            c = self._context(wf)
        except Exception as e:
            return StageOutcome.fail("context", str(e))

        if not self._actor_or_gm(ctx, c):
            return StageOutcome.fail("", "Only actor or GM can choose bonuses")

        parsed = ctx.rb.parse_input(BonusesInput, raw, wf, ctx)
        if isinstance(parsed, SubmitResult):
            return StageOutcome(ok=False, issues=parsed.issues)

        available = self._available_bonuses(wf, ctx, c)
        allowed_ids = {b["id"] for b in available}

        selected: list[str] = []
        bonus_total = 0
        for bid in parsed.consume_bonus_ids or []:
            if bid not in allowed_ids:
                return StageOutcome.fail("consume_bonus_ids", f"Unknown or inapplicable bonus: {bid}")
            selected.append(bid)
            item = next(b for b in available if b["id"] == bid)
            if item.get("consume_on") == "roll":
                bonus_total += int(item.get("amount") or 0)

        if parsed.resource_bonus_total and parsed.resource_bonus_total != bonus_total:
            bonus_total = int(parsed.resource_bonus_total)

        return StageOutcome.ok_data({
            "consume_bonus_ids": selected,
            "resource_bonus_total": bonus_total,
        })

    def submit(self, wf: Workflow, ctx: StageCtx, data: dict[str, Any]) -> SubmitResult:
        validation = self.validate_submit(wf, ctx, data)
        if not validation.ok:
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=validation.issues,
            )

        self.put(wf, validation.data)
        c = self._context(wf)
        self.assemble(wf, ctx, c.entry)
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

    def start_data(self, wf: Workflow, ctx: StageCtx) -> dict[str, Any]:
        try:
            c = self._context(wf)
        except Exception:
            return {}
        available = self._available_bonuses(wf, ctx, c)
        return {
            "bonusOptions": available,
            "selectedBonusIds": list(c.entry.roll.temp_bonus_ids or []),
            "primaryMoveId": primary_move_id(c.entry),
        }
