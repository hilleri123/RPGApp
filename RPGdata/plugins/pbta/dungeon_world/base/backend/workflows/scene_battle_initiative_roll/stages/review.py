from __future__ import annotations

from typing import Any

from plugins.common.protocols import StageCtx, issue
from plugins.common.types import SubmitResult, Workflow

from ..types import InitiativeContext


class InitiativeReviewStage:
    """Мастер проверяет броски и подтверждает порядок.

    Правки (порядок, добавление, перебросы) идут через `patch` workflow; сам
    `submit` только подтверждает то, что уже лежит в контексте.
    """

    key = "initiative.review"

    def submit(self, wf: Workflow, ctx: StageCtx, input_dict: dict[str, Any]) -> SubmitResult:
        if ctx.actor_user_id != ctx.participants.gmUserId:
            return self._fail(wf, ctx, "Подтвердить порядок может только мастер")

        try:
            c = InitiativeContext.model_validate(wf.context or {})
        except Exception:
            return self._fail(wf, ctx, "Контекст инициативы повреждён")

        if not c.entries:
            return self._fail(wf, ctx, "Очередь пуста")

        return ctx.rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
        )

    @staticmethod
    def _fail(wf: Workflow, ctx: StageCtx, message: str) -> SubmitResult:
        return ctx.rb.result(
            ok=False,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[issue("", message)],
        )
