from __future__ import annotations

from ..types import StageEnvelope, UiSpec, WrapUpInput
from ..scene import find_character_ref, character_data
from ..stage_base import BaseStage, StageCtx, _issue
from ..stress import patch_character_data


class WrapUpStage(BaseStage):
    key = "wrap_up"

    def present(self, wf, ctx: StageCtx) -> StageEnvelope:
        return StageEnvelope(
            audience=[{"kind": "gm"}],
            stageKey=wf.stageKey,
            stageData={
                "roll": wf.context.get("roll") or {},
                "resist": wf.context.get("resist"),
                "summary": wf.context.get("summary"),
                "needsTrauma": bool(wf.context.get("needsTrauma")),
                "traumaCharacterId": wf.context.get("traumaCharacterId"),
                "stressEvents": wf.context.get("stressEvents") or [],
            },
            ui=UiSpec(component="blades.RollAction.WrapUp", props={}),
        )

    def submit(self, wf, ctx: StageCtx, input_dict):
        if not ctx.participants.has(ctx.actor_user_id, "gm"):
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict,
                                 issues=[_issue("", "Only GM can wrap up")])

        parsed = ctx.rb.parse_input(WrapUpInput, input_dict, ctx.rb, wf, ctx)
        if not isinstance(parsed, WrapUpInput):
            return parsed

        if parsed.summary is not None:
            wf.context["summary"] = parsed.summary

        # trauma: добавляем в CharacterData.traumas (list)
        trauma_patch = None
        if parsed.trauma is not None:
            wf.context["trauma"] = parsed.trauma

            target_cid = wf.context.get("traumaCharacterId") or wf.context.get("character_id")
            ch_ref = find_character_ref(ctx.scene, str(target_cid)) if target_cid else None
            if not ch_ref:
                return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict,
                                     issues=[_issue("context.traumaCharacterId", "Trauma character not found in scene")])

            ch_data = character_data(ch_ref)
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

        wf.stageKey = "done"
        wf.status = "completed"
        return ctx.rb.result(ok=True, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict, sessionPatch=trauma_patch)
