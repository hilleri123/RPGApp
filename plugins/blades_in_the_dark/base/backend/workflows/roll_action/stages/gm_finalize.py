from __future__ import annotations

from ..types import StageEnvelope, UiSpec, GmFinalizeInput
from ..stage_base import BaseStage, StageCtx, _issue


class GmFinalizeStage(BaseStage):
    key = "gm_finalize"

    def present(self, wf, ctx: StageCtx) -> StageEnvelope:
        return StageEnvelope(
            audience=[{"kind": "gm"}],
            stageKey=wf.stageKey,
            stageData={
                "selectedAction": wf.context.get("selectedAction"),
                "character_id": wf.context.get("character_id"),
                "position": wf.context.get("position"),
                "effect": wf.context.get("effect"),
                "consequence_hint": wf.context.get("consequence_hint"),
                "mods": wf.context.get("mods") or {},
            },
            ui=UiSpec(component="blades.RollAction.GmFinalize", props={}),
        )

    def submit(self, wf, ctx: StageCtx, input_dict):
        if not ctx.participants.has(ctx.actor_user_id, "gm"):
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict,
                                 issues=[_issue("", "Only GM can finalize")])

        parsed = ctx.rb.parse_input(GmFinalizeInput, input_dict, ctx.rb, wf, ctx)
        if not isinstance(parsed, GmFinalizeInput):
            return parsed

        if not parsed.allow:
            wf.stageKey = "choose_action"
            return ctx.rb.result(ok=True, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict)

        if parsed.action:
            wf.context["selectedAction"] = parsed.action
        if "item_id" in input_dict:
            wf.context["item_id"] = parsed.item_id

        if parsed.position:
            wf.context["position"] = parsed.position
        if parsed.effect:
            wf.context["effect"] = parsed.effect
        if parsed.consequence_hint is not None:
            wf.context["consequence_hint"] = parsed.consequence_hint

        wf.stageKey = "prerollconfirm"
        return ctx.rb.result(ok=True, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict)
