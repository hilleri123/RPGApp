from __future__ import annotations

from typing import Any, Optional

from ..types import AssistConfirmInput
from plugins.common.types import Workflow, ActionContext
from plugins.common.protocols import BaseStage, StageCtx, issue
from ..stress import apply_stress



class AssistConfirmStage(BaseStage):
    key = "assist_confirm"


    def submit(self, action_context: ActionContext, ctx: StageCtx):
        wf = action_context.workflow
        input_dict = action_context.input or {}
        mods = wf.context.get("mods") or {}
        helper_user_id = mods.get("helper_user_id")

        if not helper_user_id or str(helper_user_id) != str(ctx.actor_user_id):
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("", "Only selected helper can confirm help")])

        parsed = ctx.rb.parse_input(AssistConfirmInput, input_dict, wf, ctx)
        if not isinstance(parsed, AssistConfirmInput):
            return parsed

        if not parsed.accept_help:
            mods["help"] = False
            mods["helper_user_id"] = None
            mods["help_confirmed"] = False
            wf.context["mods"] = mods
            wf.stageKey = "gm_finalize"
            return ctx.rb.result(ok=True, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict)

        mods["help_confirmed"] = True
        wf.context["mods"] = mods

        helper_char_id = next((c for c, u in action_context.links.characterToUserId.items() if u == helper_user_id), None)
        helper_char_ref = next((c for c in ctx.scene.characters if c.id == helper_char_id), None)
        if helper_char_ref is None:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("context.mods.helper_user_id", "Helper character not found in scene")])

        patch, overflow = apply_stress(wf=wf, scene=ctx.scene, character_id=helper_char_id, delta=1, reason="assist",
                                      meta={"helper_user_id": str(helper_user_id)})

        wf.stageKey = "wrap_up" if overflow else "gm_finalize"
        return ctx.rb.result(ok=True, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict, sessionPatch=patch)
