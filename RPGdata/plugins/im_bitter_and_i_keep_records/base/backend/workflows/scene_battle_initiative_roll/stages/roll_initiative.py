from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

from pydantic import ValidationError

from plugins.common.types import Workflow, StageEnvelope, SubmitResult
from plugins.common.protocols import StageCtx, issue
from ..types import InitiativeWorkflowContext, InitiativeRollInput


class InitiativeRollOneStage:
    key = "initiative.roll_one"


    def submit(self, wf: Workflow, ctx: StageCtx, input_dict: dict[str, Any]) -> SubmitResult:
        # контекст
        try:
            c = InitiativeWorkflowContext.model_validate(wf.context or {})
        except ValidationError as e:
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("context", str(e))],
            )

        entry = c.current_entry
        if entry is None:
            wf.status = "active"
            wf.stageKey = "initiative.result"
            return ctx.rb.result(
                ok=True,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[],
            )

        # Только owner может кидать (GM не кидает за игрока этим шагом)
        if entry.ownerUserId is None:
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("context", "Current entry has no ownerUserId")],
            )

        if ctx.actor_user_id != entry.ownerUserId:
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("", "Only current player can roll initiative now")],
            )

        parsed = ctx.rb.parse_input(InitiativeRollInput, input_dict, wf, ctx)
        if isinstance(parsed, SubmitResult):
            return parsed

        # применяем результат
        entry.rolled = True
        entry.result = parsed.result

        c.order[c.currentIndex] = entry
        c.seek_next_unrolled()

        wf.context = c.model_dump(mode="json")

        # если закончили — переводим workflow в done, и просим менеджер применить patch
        if c.is_done:
            # НЕ делаем patch тут. Переходим на стадию результата.
            wf.stageKey = "initiative.result"
            wf.status = "active"
            wf.context = c.model_dump(mode="json")

            return ctx.rb.result(
                ok=True,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[],
            )

        # иначе остаёмся на том же шаге
        return ctx.rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
        )
