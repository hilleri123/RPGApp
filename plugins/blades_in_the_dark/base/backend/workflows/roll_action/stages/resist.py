from __future__ import annotations

from ..types import StageEnvelope, UiSpec, ResistInput, ACTION_TO_ATTRIBUTE
from ..dice import roll_d6, best_and_crit
from ..scene import find_character_ref, character_data, attribute_rating
from ..stage_base import BaseStage, StageCtx, _issue
from ..stress import apply_stress


class ResistStage(BaseStage):
    key = "resist"

    def present(self, wf, ctx: StageCtx) -> StageEnvelope:
        return StageEnvelope(
            audience=[{"kind": "gm"}],
            stageKey=wf.stageKey,
            stageData={
                "roll": wf.context.get("roll") or {},
                "consequence_hint": wf.context.get("consequence_hint"),
            },
            ui=UiSpec(component="blades.RollAction.Resist", props={"attributes": ["insight", "prowess", "resolve"]}),
        )

    def submit(self, wf, ctx: StageCtx, input_dict):
        if not ctx.participants.has(ctx.actor_user_id, "gm"):
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict,
                                 issues=[_issue("", "Only GM can choose resistance attribute")])

        parsed = ctx.rb.parse_input(ResistInput, input_dict, ctx.rb, wf, ctx)
        if not isinstance(parsed, ResistInput):
            return parsed

        if not parsed.confirm:
            wf.stageKey = "wrap_up"
            return ctx.rb.result(ok=True, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict)

        cid = wf.context.get("character_id")
        ch_ref = find_character_ref(ctx.scene, str(cid)) if cid else None
        if not ch_ref:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict,
                                 issues=[_issue("context.character_id", "Character not found in scene")])

        ch_data = character_data(ch_ref)

        attr = parsed.attribute
        pool = attribute_rating(ch_data, ACTION_TO_ATTRIBUTE, attr)
        rolls = roll_d6(pool)

        best, is_crit = best_and_crit(rolls)
        stress_cost = max(0, 6 - best)
        if is_crit:
            stress_cost = max(0, stress_cost - 1)

        wf.context["resist"] = {
            "attribute": attr,
            "pool": pool,
            "rolls": rolls,
            "best": best,
            "crit": bool(is_crit),
            "stressCost": stress_cost,
        }

        wf.context["resist_broadcasts"] = [{
            "type": "dice.roll",
            "subtype": "resistance",
            **(wf.context["resist"]),
        }]

        patch, overflow = apply_stress(
            wf=wf,
            scene=ctx.scene,
            character_id=str(cid),
            delta=stress_cost,
            reason="resist",
            meta={"attribute": str(attr), "best": best, "crit": bool(is_crit)},
        )

        wf.stageKey = "wrap_up"
        return ctx.rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            broadcasts=wf.context.get("resist_broadcasts") or [],
            sessionPatch=patch,
        )
