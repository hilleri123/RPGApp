from __future__ import annotations

from ..types import StageEnvelope, UiSpec, PlayerModsInput
from ..stage_base import BaseStage, StageCtx, _issue


class PlayerAddModsStage(BaseStage):
    key = "player_add_mods"

    def present(self, wf, ctx: StageCtx) -> StageEnvelope:
        return StageEnvelope(
            audience=[{"kind": "initiator"}],
            stageKey=wf.stageKey,
            stageData={
                "selectedAction": wf.context.get("selectedAction"),
                "position": wf.context.get("position"),
                "effect": wf.context.get("effect"),
                "consequence_hint": wf.context.get("consequence_hint"),
                "mods": wf.context.get("mods") or {},
            },
            ui=UiSpec(component="blades.RollAction.PlayerAddMods", props={}),
        )

    def submit(self, wf, ctx: StageCtx, input_dict):
        if not ctx.participants.has(ctx.actor_user_id, "initiator"):
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict,
                                 issues=[_issue("", "Only initiator can add mods")])

        parsed = ctx.rb.parse_input(PlayerModsInput, input_dict, ctx.rb, wf, ctx)
        if not isinstance(parsed, PlayerModsInput):
            return parsed

        if parsed.push and parsed.devils_bargain:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict,
                                 issues=[_issue("input", "Нельзя одновременно Push Yourself и Сделку с дьяволом")])

        if parsed.help and not parsed.helper_user_id:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict,
                                 issues=[_issue("input.helper_user_id", "Нужно выбрать помогающего")])

        wf.context["mods"] = {
            "push": bool(parsed.push),
            "help": bool(parsed.help),
            "helper_user_id": parsed.helper_user_id,
            "help_confirmed": False,
            "devils_bargain": bool(parsed.devils_bargain),
            "bonus_dice": max(0, int(parsed.bonus_dice)),
        }

        wf.stageKey = "assist_confirm" if parsed.help else "gm_finalize"
        return ctx.rb.result(ok=True, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict)
