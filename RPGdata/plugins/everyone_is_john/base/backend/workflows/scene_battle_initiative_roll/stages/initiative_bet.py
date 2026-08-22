from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ValidationError
from pydantic.types import NonNegativeInt

from plugins.common.types import Workflow, SubmitResult
from plugins.common.protocols import StageCtx, issue
from ..types import InitiativeWorkflowContext


class BetInput(BaseModel):
    spend_tokens: NonNegativeInt


class InitiativeBetStage:
    key = "initiative.bet"

    def submit(self, wf: Workflow, ctx: StageCtx, input_dict: dict[str, Any]) -> SubmitResult:
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

        parsed = ctx.rb.parse_input(BetInput, input_dict, wf, ctx)
        if isinstance(parsed, SubmitResult):
            return parsed

        actor: UUID = ctx.actor_user_id

        # 1) найдём entry игрока
        idx: Optional[int] = None
        for i, e in enumerate(c.order):
            if e.ownerUserId is not None and e.ownerUserId == actor:
                idx = i
                break

        # 2) если ownerUserId не заполнен/не совпал — попробуем восстановить через links
        if idx is None:
            if ctx.links is None:
                return ctx.rb.result(
                    ok=False,
                    wf=wf,
                    participants=ctx.participants,
                    participants_dict_fallback=ctx.participants_dict,
                    issues=[issue("links", "StageCtx.links is missing; cannot map actor to character")],
                )

            # найдём персонажа, у которого links.characterToUserId[entityId] == actor
            for i, e in enumerate(c.order):
                owner = ctx.links.characterToUserId.get(e.entityId)
                if owner == actor:
                    # подлечим контекст, чтобы дальше работало быстрее
                    e.ownerUserId = owner
                    c.order[i] = e
                    idx = i
                    break

        if idx is None:
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("", "Actor is not linked to any character in this workflow")],
            )

        entry = c.order[idx]

        if int(parsed.spend_tokens) > int(entry.available_tokens):
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("spend_tokens", "spend_tokens > available_tokens")],
            )

        # 3) записать ставку
        entry.spend_tokens = parsed.spend_tokens
        c.order[idx] = entry

        wf.context = c.model_dump(mode="json")
        return ctx.rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
        )
