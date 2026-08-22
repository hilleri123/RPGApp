# plugins/gumshoe/npc_dialog/stages/dialog_loop.py
from __future__ import annotations
from typing import Any, Optional, Literal
from pydantic import BaseModel
from plugins.common.types import Workflow, SubmitResult
from plugins.common.protocols import StageCtx, BaseStage, issue
from ..types import DialogContext, DialogSpendRecord
from ....types import CharacterData


class DialogLoopInput(BaseModel):
    action: Literal["request_spend", "finish"]
    skill_name: Optional[str] = None
    cost: Optional[int] = None
    note: Optional[str] = None
    character_id: Optional[str] = None   # ← ГМ явно выбирает кто тратит


class DialogLoopStage(BaseStage):
    key = "gumshoe.npc_dialog.dialog_loop"

    def __init__(self, full_codex): super().__init__(full_codex)

    def submit(self, wf: Workflow, ctx: StageCtx, input_dict: dict[str, Any]) -> SubmitResult:
        if ctx.actor_user_id != ctx.participants.gmUserId:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants,
                                 participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("", "Only GM can act in dialog_loop")])

        try:
            c = DialogContext.model_validate(wf.context or {})
        except Exception as e:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants,
                                 participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("context", str(e))])

        parsed = ctx.rb.parse_input(DialogLoopInput, input_dict, wf, ctx)
        if isinstance(parsed, SubmitResult):
            return parsed

        entry = c.entry

        if parsed.action == "finish":
            entry.finished = True
            c.entry = entry
            wf.context = c.model_dump(mode="json")
            wf.stageKey = "gumshoe.npc_dialog.result"
            return ctx.rb.result(ok=True, wf=wf, participants=ctx.participants,
                                 participants_dict_fallback=ctx.participants_dict, issues=[])

        # request_spend
        if not parsed.skill_name:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants,
                                 participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("skill_name", "Required")])

        cost = max(1, parsed.cost or 1)

        # Проверяем что хоть у кого-то из персонажей есть этот навык
        chars_with_skill = []
        for char in (ctx.scene.characters or []):
            if str(char.id) not in entry.character_ids:
                continue
            char_data = CharacterData.model_validate(char.data) if char.data else CharacterData()
            spent = sum(
                r.cost for r in entry.spend_records
                if r.skill_name == parsed.skill_name
                and r.character_id == str(char.id)
                and r.confirmed
            )
            avail = max(0, char_data.skills.get(parsed.skill_name, 0) - spent)
            if avail >= cost:
                chars_with_skill.append(str(char.id))

        # Берём первого кто может — или можно будет выбирать на фронте
        if parsed.character_id and parsed.character_id in entry.character_ids:
            character_id = parsed.character_id
        elif chars_with_skill:
            character_id = chars_with_skill[0]
        else:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants,
                                 participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("skill_name", "No participants can afford this")])

        entry.spend_records.append(DialogSpendRecord(
            character_id=character_id,
            skill_name=parsed.skill_name,
            cost=cost,
            note=parsed.note or "",
            confirmed=False,
        ))

        c.entry = entry
        wf.context = c.model_dump(mode="json")
        wf.stageKey = "gumshoe.npc_dialog.gm_confirm_spend"

        return ctx.rb.result(ok=True, wf=wf, participants=ctx.participants,
                             participants_dict_fallback=ctx.participants_dict, issues=[])