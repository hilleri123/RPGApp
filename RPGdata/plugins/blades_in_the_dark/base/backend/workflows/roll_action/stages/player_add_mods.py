from __future__ import annotations
from typing import Any

from ..types import PlayerModsInput
from plugins.common.protocols import BaseStage, StageCtx, issue
from plugins.common.types import Workflow, ActionContext


class PlayerAddModsStage(BaseStage):
    key = "player_add_mods"


    def submit(self, action_context: ActionContext, ctx: StageCtx):
        wf = action_context.workflow
        input_dict = action_context.input or {}
        if not ctx.participants.has(ctx.actor_user_id, "initiator"):
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("", "Only initiator can add mods")])

        parsed = ctx.rb.parse_input(PlayerModsInput, input_dict, wf, ctx)
        if not isinstance(parsed, PlayerModsInput):
            return parsed

        if parsed.push and parsed.devils_bargain:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("input", "Нельзя одновременно Push Yourself и Сделку с дьяволом")])

        if parsed.help and not parsed.helper_user_id:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("input.helper_user_id", "Нужно выбрать помогающего")])

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
