# plugins/gumshoe/contest/stages/contest_roll.py
from __future__ import annotations
from typing import Any
import random
from pydantic import BaseModel

from plugins.common.types import Workflow, SubmitResult
from plugins.common.protocols import StageCtx, BaseStage, issue
from ..types import ContestContext, ContestSide


class ContestRollInput(BaseModel):
    canvas_seed: str


class ContestRollStage(BaseStage):
    key = "gumshoe.contest.roll"
    def __init__(self, full_codex):
        super().__init__(full_codex)

    def submit(self, wf: Workflow, ctx: StageCtx, input_dict: dict[str, Any]) -> SubmitResult:
        def err(f, m):
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants,
                                 participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue(f, m)])

        try:
            c = ContestContext.model_validate(wf.context or {})
        except Exception as e:
            return err("context", str(e))

        parsed = ctx.rb.parse_input(ContestRollInput, input_dict, wf, ctx)
        if isinstance(parsed, SubmitResult):
            return parsed

        entry = c.entry
        actor = ctx.actor_user_id
        is_gm = actor == ctx.participants.gmUserId

        side_key = _side_for_roll(entry, actor, is_gm)
        if side_key is None:
            return err("", "You are not expected to roll now")

        side = entry.side_a if side_key == "a" else entry.side_b

        rng  = random.Random(parsed.canvas_seed)
        roll = rng.randint(1, 6)
        side.canvas_seed = parsed.canvas_seed
        side.dice        = [roll]
        side.roll_total  = roll + side.skill_points
        side.passed = side.roll_total >= side.difficulty

        c.entry = entry
        wf.context = c.model_dump(mode="json")

        # Если оба бросили — к результату
        if entry.side_a.roll_total is not None and entry.side_b.roll_total is not None:
            wf.stageKey = "gumshoe.contest.result"

        return ctx.rb.result(ok=True, wf=wf, participants=ctx.participants,
                             participants_dict_fallback=ctx.participants_dict,
                             issues=[])


def _side_for_roll(entry, actor_id, is_gm) -> ContestSide | None:
    def owns_and_not_rolled(side) -> bool:
        if side.roll_total is not None:
            return False
        if side.userId and str(side.userId) == str(actor_id):
            return True
        if side.npcId and is_gm:
            return True
        if not side.characterId and not side.npcId and is_gm:
            return True
        return False

    if owns_and_not_rolled(entry.side_a):
        return "a"
    if owns_and_not_rolled(entry.side_b):
        return "b"
    return None
