from __future__ import annotations

from typing import Optional

from ..types import StageEnvelope, UiSpec, AssistConfirmInput
from ..stage_base import BaseStage, StageCtx, _issue
from ..stress import apply_stress


def _find_first_character_id_for_user(scene: dict, uid: str) -> Optional[str]:
    players = (scene or {}).get("players") or {}
    entry = players.get(str(uid)) or players.get(uid)
    if not entry:
        return None
    chars = entry.get("characters") or []
    if not chars:
        return None
    ch0 = chars[0] or {}
    cid = ch0.get("id")
    return str(cid) if cid else None


class AssistConfirmStage(BaseStage):
    key = "assist_confirm"

    def present(self, wf, ctx: StageCtx) -> StageEnvelope:
        helper_user_id = (wf.context.get("mods") or {}).get("helper_user_id")
        return StageEnvelope(
            audience=[{"kind": "user", "user_id": helper_user_id}],
            stageKey=wf.stageKey,
            stageData={"selectedAction": wf.context.get("selectedAction"), "character_id": wf.context.get("character_id")},
            ui=UiSpec(component="blades.RollAction.AssistConfirm", props={}),
        )

    def submit(self, wf, ctx: StageCtx, input_dict):
        mods = wf.context.get("mods") or {}
        helper_user_id = mods.get("helper_user_id")

        if not helper_user_id or str(helper_user_id) != str(ctx.actor_user_id):
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict,
                                 issues=[_issue("", "Only selected helper can confirm help")])

        parsed = ctx.rb.parse_input(AssistConfirmInput, input_dict, ctx.rb, wf, ctx)
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

        helper_char_id = _find_first_character_id_for_user(ctx.scene, str(helper_user_id))
        if not helper_char_id:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict,
                                 issues=[_issue("context.mods.helper_user_id", "Helper character not found in scene")])

        patch, overflow = apply_stress(wf=wf, scene=ctx.scene, character_id=helper_char_id, delta=1, reason="assist",
                                      meta={"helper_user_id": str(helper_user_id)})

        wf.stageKey = "wrap_up" if overflow else "gm_finalize"
        return ctx.rb.result(ok=True, wf=wf, participants=ctx.participants, participants_dict_fallback=ctx.participants_dict, sessionPatch=patch)
