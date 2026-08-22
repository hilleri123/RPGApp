from __future__ import annotations
from typing import Any

from ..types import WrapUpInput
from plugins.common.protocols import BaseStage, StageCtx, issue
from plugins.common.types import Workflow, ActionContext
from ..stress import patch_character_data
from ....types import CharacterData


class WrapUpStage(BaseStage):
    key = "wrap_up"



    def submit(self, action_context: ActionContext, ctx: StageCtx):
        wf = action_context.workflow
        input_dict = action_context.input or {}
        if not ctx.participants.has(ctx.actor_user_id, "gm"):
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("", "Only GM can wrap up")])

        parsed = ctx.rb.parse_input(WrapUpInput, input_dict, wf, ctx)
        if not isinstance(parsed, WrapUpInput):
            return parsed

        if parsed.summary is not None:
            wf.context["summary"] = parsed.summary

        # trauma: добавляем в CharacterData.traumas (list)
        trauma_patch = None
        if parsed.trauma is not None:
            wf.context["trauma"] = parsed.trauma

            target_cid = wf.context.get("traumaCharacterId") or wf.context.get("character_id")
            ch_ref = next((c for c in ctx.scene.characters if str(c.id) == str(target_cid)), None)
            if ch_ref is None:
                return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict,
                                     issues=[issue("context.traumaCharacterId", "Trauma character not found in scene")])

            ch_data = CharacterData.model_validate(ch_ref.data)
            current = ch_data.get("traumas") or []
            if not isinstance(current, list):
                current = []
            t = str(parsed.trauma)

            if t not in [str(x) for x in current]:
                new_list = [*current, parsed.trauma]
            else:
                new_list = current

            trauma_patch = patch_character_data(str(target_cid), {"traumas": new_list})

            wf.context["needsTrauma"] = False
            wf.context["traumaCharacterId"] = None

        wf.stageKey = "completed"
        wf.status = "completed"
        return ctx.rb.result(ok=True, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict, sessionPatch=trauma_patch)
