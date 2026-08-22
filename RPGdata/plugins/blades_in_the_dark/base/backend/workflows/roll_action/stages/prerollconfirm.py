from __future__ import annotations
from typing import Any

from ..types import ACTION_TO_ATTRIBUTE, PreRollConfirmInput
from ..dice import roll_d6, outcome_from
from plugins.common.protocols import BaseStage, StageCtx, issue
from plugins.common.types import CharacterContext, Workflow, ActionContext
from ..stress import apply_stress
from ....types import CharacterData, ActionId


class PreRollConfirmStage(BaseStage):
    key = "prerollconfirm"


    def submit(self, action_context: ActionContext, ctx: StageCtx):
        wf = action_context.workflow
        input_dict = action_context.input or {}
        if not ctx.participants.has(ctx.actor_user_id, "initiator"):
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("", "Only initiator can confirm pre-roll")])

        parsed = ctx.rb.parse_input(PreRollConfirmInput, input_dict, wf, ctx)
        if not isinstance(parsed, PreRollConfirmInput):
            return parsed

        if parsed.choice != "accept":
            wf.stageKey = "choose_action"
            wf.context["position"] = None
            wf.context["effect"] = None
            wf.context["consequence_hint"] = None
            wf.context["mods"] = {
                "push": False,
                "help": False,
                "helper_user_id": None,
                "help_confirmed": False,
                "devils_bargain": False,
                "bonus_dice": 0,
            }
            wf.context["roll"] = None
            wf.context["roll_broadcasts"] = []
            wf.context["resist"] = None
            wf.context["resist_broadcasts"] = []
            wf.context["summary"] = None
            wf.context["trauma"] = None
            wf.context["stressEvents"] = []
            wf.context["needsTrauma"] = False
            wf.context["traumaCharacterId"] = None
            return ctx.rb.result(ok=True, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict)

        action: ActionId = wf.context.get("selectedAction")
        if action not in ACTION_TO_ATTRIBUTE:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("context.selectedAction", "Action not selected")])

        cid = wf.context.get("character_id")
        ch_ref: CharacterContext = next((c for c in ctx.scene.characters if str(c.id) == str(cid)), None)
        if ch_ref is None:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("context.character_id", "Character not found in scene")])

        ch_data = CharacterData.model_validate(ch_ref.data)
        base = ch_data.actions.get(action, 0)

        mods = wf.context.get("mods") or {}
        bonus = 0
        if mods.get("push"):
            bonus += 1
        if mods.get("help") and mods.get("help_confirmed"):
            bonus += 1
        if mods.get("devils_bargain"):
            bonus += 1
        # try:
        #     bonus += max(0, int(mods.get("bonus_dice") or 0))
        # except Exception:
        #     pass

        pool = base + bonus
        rolls = roll_d6(pool)
        out, crit, best = outcome_from(rolls)

        wf.context["roll"] = {
            "character_id": cid,
            "character_name": ch_ref.name,
            "action": action,
            "base": base,
            "bonus": bonus,
            "pool": pool,
            "rolls": rolls,
            "best": best,
            "crit": crit,
            "outcome": out,
            "position": wf.context.get("position"),
            "effect": wf.context.get("effect"),
        }

        wf.context["roll_broadcasts"] = [{
            "type": "dice.roll",
            "subtype": "action",
            **(wf.context["roll"]),
        }]

        roll_ctx = wf.context["roll"]
        log_events = [
            ctx.rb.log_roll(
                title=f"{roll_ctx.get('character_name', 'Персонаж')} · {action}",
                dice=[int(x) for x in rolls],
                total=int(best),
                outcome=str(out),
                meta={
                    "position": roll_ctx.get("position"),
                    "effect": roll_ctx.get("effect"),
                    "crit": crit,
                    "pool": pool,
                },
            ),
        ]

        patch = None
        overflow = False
        if mods.get("push"):
            patch, overflow = apply_stress(wf=wf, scene=ctx.scene, character_id=str(cid), delta=2, reason="push")

        wf.stageKey = "wrap_up" if overflow else "mitigate"

        return ctx.rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            broadcasts=wf.context.get("roll_broadcasts") or [],
            logEvents=log_events,
            sessionPatch=patch,
        )
