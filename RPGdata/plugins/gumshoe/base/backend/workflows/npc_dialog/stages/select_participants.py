# plugins/gumshoe/npc_dialog/stages/select_participants.py
from __future__ import annotations
from typing import Any
from uuid import UUID
from pydantic import BaseModel
from plugins.common.types import Workflow, SubmitResult
from plugins.common.protocols import StageCtx, BaseStage, issue
from ..types import DialogContext, DialogEntry


class SelectParticipantsInput(BaseModel):
    character_ids: list[str]
    npc_ids: list[str]


class SelectParticipantsStage(BaseStage):
    key = "gumshoe.npc_dialog.select_participants"

    def __init__(self, full_codex): super().__init__(full_codex)

    def submit(self, wf: Workflow, ctx: StageCtx, input_dict: dict[str, Any]) -> SubmitResult:
        if ctx.actor_user_id != ctx.participants.gmUserId:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants,
                                 participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("", "Only GM")])

        parsed = ctx.rb.parse_input(SelectParticipantsInput, input_dict, wf, ctx)
        if isinstance(parsed, SubmitResult):
            return parsed

        if not parsed.character_ids or not parsed.npc_ids:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants,
                                 participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("", "Need at least one char and one npc")])

        try:
            c = DialogContext.model_validate(wf.context or {})
        except Exception as e:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants,
                                 participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("context", str(e))])

        player_user_ids: list[str] = []
        for char_id_str in parsed.character_ids:
            try:
                uid = ctx.links.characterToUserId.get(UUID(char_id_str))
                if uid:
                    player_user_ids.append(str(uid))
            except Exception:
                pass

        c.entry = DialogEntry(
            character_ids=parsed.character_ids,
            npc_ids=parsed.npc_ids,
            player_user_ids=player_user_ids,   # ← сохраняем
        )

        wf.context = c.model_dump(mode="json")
        wf.stageKey = "gumshoe.npc_dialog.dialog_loop"

        return ctx.rb.result(ok=True, wf=wf, participants=ctx.participants,
                             participants_dict_fallback=ctx.participants_dict, issues=[])