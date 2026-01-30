from __future__ import annotations

from ..types import StageEnvelope, UiSpec, GmSetInput
from ..stage_base import BaseStage, StageCtx, _issue


class GmSetPositionEffectStage(BaseStage):
    key = "gm_set_position_effect"

    def present(self, wf, ctx: StageCtx) -> StageEnvelope:
        return StageEnvelope(
            audience=[{"kind": "gm"}],
            stageKey=wf.stageKey,
            stageData={"selectedAction": wf.context.get("selectedAction"), "character_id": wf.context.get("character_id")},
            ui=UiSpec(
                component="blades.RollAction.GmSetPositionEffect",
                props={"positions": ["controlled", "risky", "desperate"], "effects": ["limited", "standard", "great"]},
            ),
        )

    def submit(self, wf, ctx: StageCtx, input_dict):
        if not ctx.participants.has(ctx.actor_user_id, "gm"):
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict,
                                 issues=[_issue("", "Only GM can set position/effect")])

        parsed = ctx.rb.parse_input(GmSetInput, input_dict, ctx.rb, wf, ctx)
        if not isinstance(parsed, GmSetInput):
            return parsed

        wf.context["position"] = parsed.position
        wf.context["effect"] = parsed.effect
        wf.context["consequence_hint"] = parsed.consequence_hint or ""

        wf.stageKey = "player_add_mods"
        return ctx.rb.result(ok=True, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict)
