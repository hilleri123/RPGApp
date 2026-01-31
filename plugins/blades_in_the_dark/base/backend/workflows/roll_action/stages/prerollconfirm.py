from __future__ import annotations

from ..types import ACTION_TO_ATTRIBUTE, StageEnvelope, UiSpec, PreRollConfirmInput
from ..dice import roll_d6, outcome_from
from ..scene import find_character_ref, character_data, character_name, action_rating
from ..stage_base import BaseStage, StageCtx, _issue
from ..stress import apply_stress


class PreRollConfirmStage(BaseStage):
    key = "prerollconfirm"

    def present(self, wf, ctx: StageCtx) -> StageEnvelope:
        return StageEnvelope(
            audience=[{"kind": "initiator"}],
            stageKey=wf.stageKey,
            stageData={
                "selectedAction": wf.context.get("selectedAction"),
                "character_id": wf.context.get("character_id"),
                "position": wf.context.get("position"),
                "effect": wf.context.get("effect"),
                "consequence_hint": wf.context.get("consequence_hint"),
                "mods": wf.context.get("mods") or {},
            },
            ui=UiSpec(component="blades.RollAction.PreRollConfirm", props={}),
        )

    def submit(self, wf, ctx: StageCtx, input_dict):
        if not ctx.participants.has(ctx.actor_user_id, "initiator"):
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict,
                                 issues=[_issue("", "Only initiator can confirm pre-roll")])

        parsed = ctx.rb.parse_input(PreRollConfirmInput, input_dict, ctx.rb, wf, ctx)
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

        action = wf.context.get("selectedAction")
        if action not in ACTION_TO_ATTRIBUTE:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict,
                                 issues=[_issue("context.selectedAction", "Action not selected")])

        cid = wf.context.get("character_id")
        ch_ref = find_character_ref(ctx.scene, str(cid)) if cid else None
        if not ch_ref:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict,
                                 issues=[_issue("context.character_id", "Character not found in scene")])

        ch_data = character_data(ch_ref)
        base = action_rating(ch_data, action)

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
            "character_name": character_name(ch_ref),
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
            sessionPatch=patch,
        )
