# plugins/everyone_is_john/perform_action/stages/action_canvas.py
from __future__ import annotations
import random
from typing import Any
from pydantic import BaseModel
from plugins.common.types import Workflow, SubmitResult
from plugins.common.protocols import StageCtx, issue
from ..types import PerformActionContext


class CanvasInput(BaseModel):
    canvas_seed: str   # base64 PNG или любая строка-seed


class ActionCanvasStage:
    key = "john.action.canvas"

    def submit(self, wf: Workflow, ctx: StageCtx, input_dict: dict[str, Any]) -> SubmitResult:
        try:
            c = PerformActionContext.model_validate(wf.context or {})
        except Exception as e:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants,
                                 participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("context", str(e))])

        parsed = ctx.rb.parse_input(CanvasInput, input_dict, wf, ctx)
        if isinstance(parsed, SubmitResult):
            return parsed

        entry = c.entry
        if entry.playerUserId != ctx.actor_user_id:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants,
                                 participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("", "Only the player can draw")])

        entry.canvas_seed = parsed.canvas_seed

        # --- бросок ---
        # базовые 3d6
        dice = 3
        # профессия: +4d6
        if entry.has_profession:
            dice += 4
        # жетоны: +2d6 за каждый
        dice += 2 * max(0, entry.spend_tokens or 0)
        # override мастера
        if entry.gm_dice_override is not None:
            dice = entry.gm_dice_override

        # seed из canvas_seed для детерминированности (опционально)
        rng = random.Random(parsed.canvas_seed)
        results = [rng.randint(1, 6) for _ in range(dice)]
        success = any(r == 6 for r in results)

        entry.dice_count = dice
        entry.dice_results = results
        entry.success = success

        c.entry = entry
        wf.stageKey = "john.action.result"
        wf.context = c.model_dump(mode="json")

        return ctx.rb.result(ok=True, wf=wf, participants=ctx.participants,
                             participants_dict_fallback=ctx.participants_dict, issues=[])
