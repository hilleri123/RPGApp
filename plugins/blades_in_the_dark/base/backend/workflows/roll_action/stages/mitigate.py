from __future__ import annotations

from ..types import StageEnvelope, UiSpec, MitigateInput
from ..stage_base import BaseStage, StageCtx, _issue


class MitigateStage(BaseStage):
    key = "mitigate"

    def present(self, wf, ctx: StageCtx) -> StageEnvelope:
        return StageEnvelope(
            audience=[{"kind": "initiator"}],
            stageKey=wf.stageKey,
            stageData={
                "selectedAction": wf.context.get("selectedAction"),
                "position": wf.context.get("position"),
                "effect": wf.context.get("effect"),
                "consequence_hint": wf.context.get("consequence_hint"),
                "roll": wf.context.get("roll") or {},
            },
            ui=UiSpec(component="blades.RollAction.Mitigate", props={}),
        )

    def submit(self, wf, ctx: StageCtx, input_dict):
        if not ctx.participants.has(ctx.actor_user_id, "initiator"):
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict,
                                 issues=[_issue("", "Only initiator can mitigate")])

        parsed = ctx.rb.parse_input(MitigateInput, input_dict, ctx.rb, wf, ctx)
        if not isinstance(parsed, MitigateInput):
            return parsed

        wf.stageKey = "wrap_up" if parsed.choice == "accept" else "resist"
        return ctx.rb.result(ok=True, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict)
