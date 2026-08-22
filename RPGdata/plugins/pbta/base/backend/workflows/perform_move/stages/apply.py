from __future__ import annotations

from typing import Any

from plugins.common.protocols import BaseStage, StageCtx
from plugins.common.types import SubmitResult, Workflow

from ..engine import make_apply_patch
from ..types import PerformMoveContext


class PerformMoveApplyStage(BaseStage):
    key = "perform_move.apply"

    def submit(self, wf: Workflow, ctx: StageCtx, input_dict: dict[str, Any]) -> SubmitResult:
        c = PerformMoveContext.model_validate(wf.context or {})

        patch: dict[str, list[dict]] = {}

        for effect in c.entry.effects:
            if effect.applied:
                continue

            effect_patch = make_apply_patch(ctx.scene, effect)
            for key, items in effect_patch.items():
                patch.setdefault(key, []).extend(items)

            effect.applied = True

        wf.context = c.model_dump(mode="json")
        wf.stageKey = "perform_move.result"
        wf.stageData = {
            "sessionPatch": patch or None,
        }

        return ctx.rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
        )