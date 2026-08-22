# plugins/gumshoe/task_bonus/stages/gm_confirm.py
from __future__ import annotations
from typing import Any
from datetime import datetime, timezone

from plugins.common.types import Workflow, SubmitResult
from plugins.common.protocols import StageCtx, BaseStage, issue

from ..types import TaskBonusContext, TaskBonusEntry
from ....types import CharacterData, TaskBonusRecord


class TaskBonusGmConfirmStage(BaseStage):
    key = 'gumshoe.task_bonus.gm_confirm'

    def __init__(self, full_codex):
        super().__init__(full_codex)

    def submit(self, wf: Workflow, ctx: StageCtx, input_dict: dict[str, Any]) -> SubmitResult:
        # только GM
        if str(ctx.actor_user_id) != str(ctx.participants.gmUserId):
            return ctx.rb.result(
                ok=False, wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue('', 'Only GM can confirm')],
            )

        decision: str = input_dict.get('decision', '').strip()
        if decision not in ('approve', 'reject'):
            return ctx.rb.result(
                ok=False, wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue('decision', 'decision must be approve or reject')],
            )

        try:
            c = TaskBonusContext.model_validate(wf.context or {})
        except Exception as e:
            return ctx.rb.result(
                ok=False, wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue('context', str(e))],
            )

        entry = c.entry
        if not entry:
            return ctx.rb.result(
                ok=False, wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue('entry', 'No entry in context')],
            )

        entry.decision = decision
        entry.comment = input_dict.get('comment') or None
        wf.context = TaskBonusContext(entry=entry).model_dump(mode='json')
        # wf.stageKey = 'completed'
        # wf.status = 'completed'

        session_patch: dict = {}

        # если одобрено — пишем бонус в CharacterData.bonuses
        if decision == 'approve' and entry.characterId:
            char = next(
                (ch for ch in (ctx.scene.characters or [])
                 if ch.id == entry.characterId),
                None,
            )
            if char.data:
                char_data = CharacterData.model_validate(char.data)

                char_data.bonuses.append(
                    TaskBonusRecord(
                        task_id=entry.task_id,
                        description=entry.task_description,
                        bonus=entry.task_bonus,
                        confirmed_at=datetime.now(timezone.utc).isoformat(),
                    )
                )

                session_patch['characters'] = [{
                    'id': entry.characterId,
                    'dataPatch': char_data.model_dump(mode='json'),
                }]
        wf.stageKey = 'gumshoe.task_bonus.request'

        return ctx.rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
            sessionPatch=session_patch or None,
        )