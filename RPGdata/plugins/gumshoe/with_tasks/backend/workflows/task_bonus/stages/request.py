# plugins/gumshoe/task_bonus/stages/request.py
from __future__ import annotations
from typing import Any

from plugins.common.types import Workflow, SubmitResult
from plugins.common.protocols import StageCtx, BaseStage, issue

from ..types import TaskBonusContext, TaskBonusEntry
from ....types import CharacterData


class TaskBonusRequestStage(BaseStage):
    key = 'gumshoe.task_bonus.request'

    def __init__(self, full_codex):
        super().__init__(full_codex)

    # stages/request.py
    def submit(self, wf, ctx, input_dict):
        task_id = input_dict.get('task_id', '').strip()
        if not task_id:
            return ctx.rb.result(
                ok=False, wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue('task_id', 'task_id is required')],
            )

        # берём characterId из контекста, который записали в start()
        try:
            c = TaskBonusContext.model_validate(wf.context or {})
        except Exception as e:
            return ctx.rb.result(
                ok=False, wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue('context', str(e))],
            )

        char_id = str(c.entry.characterId) if c.entry and c.entry.characterId else None
        char = next(
            (ch for ch in (ctx.scene.characters or []) if str(ch.id) == char_id),
            None,
        )

        if char is None:
            return ctx.rb.result(
                ok=False, wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue('scene', 'Character not found in scene')],
            )

        char_data = CharacterData.model_validate(char.data) if char.data else CharacterData()

        # ищем задание в tasks
        task_def = next((t for t in (char_data.tasks or []) if t.id == task_id), None)
        if not task_def:
            return ctx.rb.result(
                ok=False, wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue('task_id', f'Task {task_id!r} not found on character')],
            )


        # пишем в контекст, переходим на подтверждение GM
        c.entry.task_id          = task_def.id
        c.entry.task_description = task_def.description
        c.entry.task_bonus       = task_def.bonus

        wf.context  = c.model_dump(mode='json')
        wf.stageKey = 'gumshoe.task_bonus.gm_confirm'

        return ctx.rb.result(
            ok=True, wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
        )