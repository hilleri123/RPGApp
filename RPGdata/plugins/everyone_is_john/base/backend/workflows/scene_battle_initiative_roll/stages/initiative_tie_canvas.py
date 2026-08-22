# .../stages/initiative_tie_canvas.py
from __future__ import annotations
import hashlib
from typing import Any, Optional
from uuid import UUID
from pydantic import BaseModel, ValidationError
from plugins.common.types import Workflow, SubmitResult
from plugins.common.protocols import StageCtx, issue
from ..types import InitiativeWorkflowContext


class TieCanvasInput(BaseModel):
    canvas_seed: str  # base64 png


def _seed_to_d20(canvas_seed: str, entity_id: str) -> int:
    """Детерминированный d20 из base64 seed + entityId."""
    raw = f"{canvas_seed}:{entity_id}".encode()
    digest = hashlib.sha256(raw).digest()
    return (int.from_bytes(digest[:4], "big") % 20) + 1  # 1..20


class InitiativeTieCanvasStage:
    key = "initiative.tie_canvas"

    def submit(self, wf: Workflow, ctx: StageCtx, input_dict: dict[str, Any]) -> SubmitResult:
        try:
            c = InitiativeWorkflowContext.model_validate(wf.context or {})
        except ValidationError as e:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants,
                                 participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("context", str(e))])

        tie_set = set(str(x) for x in (c.tieEntityIds or []))
        actor: UUID = ctx.actor_user_id

        # найти entry актора в tie
        idx: Optional[int] = None
        for i, e in enumerate(c.order):
            if str(e.entityId) in tie_set and e.ownerUserId == actor:
                idx = i
                break

        if idx is None and ctx.links:
            for i, e in enumerate(c.order):
                if str(e.entityId) not in tie_set:
                    continue
                owner = ctx.links.characterToUserId.get(e.entityId)
                if owner == actor:
                    e.ownerUserId = owner
                    c.order[i] = e
                    idx = i
                    break

        if idx is None:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants,
                                 participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("", "Actor is not a tie finalist")])

        # проверяем очерёдность
        cur_idx = c.currentIndex
        cur = c.order[cur_idx] if (isinstance(cur_idx, int) and 0 <= cur_idx < len(c.order)) else None
        if cur is None or str(cur.entityId) != str(c.order[idx].entityId):
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants,
                                 participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("", "Not your turn to draw")])

        parsed = ctx.rb.parse_input(TieCanvasInput, input_dict, wf, ctx)
        if isinstance(parsed, SubmitResult):
            return parsed

        # сохраняем seed и сразу вычисляем бросок
        entry = c.order[idx]
        entry.canvas_seed = parsed.canvas_seed
        entry.tieResult = _seed_to_d20(parsed.canvas_seed, str(entry.entityId))
        entry.tieRolled = True
        c.order[idx] = entry

        # двигаем курсор к следующему финалисту без seed
        _advance_cursor(c, tie_set)

        wf.context = c.model_dump(mode="json")
        return ctx.rb.result(ok=True, wf=wf, participants=ctx.participants,
                             participants_dict_fallback=ctx.participants_dict,
                             issues=[])


def _advance_cursor(c: InitiativeWorkflowContext, tie_set: set) -> None:
    for i, e in enumerate(c.order):
        if str(e.entityId) in tie_set and e.canvas_seed is None:
            c.currentIndex = i
            return
    c.currentIndex = len(c.order)  # все нарисовали
