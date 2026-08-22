# plugins/gumshoe/npc_dialog/stages/finish.py
from __future__ import annotations
from typing import Any
from collections import defaultdict
from plugins.common.types import Workflow, SubmitResult
from plugins.common.protocols import StageCtx, BaseStage, issue
from ..types import DialogContext
from ....types import CharacterData


class DialogResultStage(BaseStage):
    key = "gumshoe.npc_dialog.result"

    def __init__(self, full_codex): super().__init__(full_codex)

    def submit(self, wf: Workflow, ctx: StageCtx, input_dict: dict[str, Any]) -> SubmitResult:
        if ctx.actor_user_id != ctx.participants.gmUserId:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants,
                                 participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("", "Only GM")])

        try:
            c = DialogContext.model_validate(wf.context or {})
        except Exception as e:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants,
                                 participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("context", str(e))])

        entry = c.entry
        wf.stageKey = "completed"
        wf.status = "completed"

        # Списываем навыки
        spent_by: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        for r in entry.spend_records:
            if r.confirmed:
                spent_by[r.character_id][r.skill_name] += r.cost

        characters_patch = []
        for char in (ctx.scene.characters or []):
            char_id = str(char.id)
            if char_id not in spent_by:
                continue
            char_data = CharacterData.model_validate(char.data) if char.data else CharacterData()
            new_skills = dict(char_data.skills)
            for skill, pts in spent_by[char_id].items():
                new_skills[skill] = max(0, new_skills.get(skill, 0) - pts)
            characters_patch.append({"id": char_id, "dataPatch": {"skills": new_skills}})

        session_patch = {}
        if characters_patch:
            session_patch["characters"] = characters_patch

        return ctx.rb.result(ok=True, wf=wf, participants=ctx.participants,
                             participants_dict_fallback=ctx.participants_dict,
                             issues=[],
                             sessionPatch=session_patch or None)