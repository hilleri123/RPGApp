from __future__ import annotations
from typing import Any

from ..types import ResistInput, ACTION_TO_ATTRIBUTE
from ..dice import roll_d6, best_and_crit
from plugins.common.protocols import BaseStage, StageCtx, issue
from plugins.common.types import Workflow, ActionContext
from ..stress import apply_stress
from ....types import CharacterData


class ResistStage(BaseStage):
    key = "resist"


    def submit(self, action_context: ActionContext, ctx: StageCtx):
        wf = action_context.workflow
        input_dict = action_context.input or {}
        if not action_context.participants.gmUserId == action_context.actorUserId:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("", "Only GM can choose resistance attribute")])

        parsed = ctx.rb.parse_input(ResistInput, input_dict, wf, ctx)
        if not isinstance(parsed, ResistInput):
            return parsed

        if not parsed.confirm:
            wf.stageKey = "wrap_up"
            return ctx.rb.result(ok=True, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict)

        cid = wf.context.get("character_id")
        ch_ref = next((c for c in ctx.scene.characters if str(c.id) == str(cid)), None)
        if ch_ref is None:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("context.character_id", "Character not found in scene")])

        ch_data = CharacterData.model_validate(ch_ref.data)

        attr = parsed.attribute
        pool = 0
        for action, value in ch_data.actions.items():
            if ACTION_TO_ATTRIBUTE[action] == attr:
                pool += 1 if value > 0 else 0
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
