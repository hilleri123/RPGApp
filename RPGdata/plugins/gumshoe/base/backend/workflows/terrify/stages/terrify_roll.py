from __future__ import annotations
import random
from typing import Any
from uuid import UUID

from pydantic import BaseModel

from plugins.common.types import Workflow, SubmitResult
from plugins.common.protocols import StageCtx
from .terrify_result import TerrifyResultStage
from ..types import TerrifyContext


class TargetRollInput(BaseModel):
    characterId: str
    seed: str
    spentStability: int = 0


class InputDict(BaseModel):
    seeds: dict[str, Any] = {}
    spentStability: dict[str, int] = {}


class TerrifyRollStage:
    key = "gumshoe.terrify.roll"

    def __init__(self, full_codex):
        self.full_codex = full_codex

    def submit(self, wf: Workflow, ctx: StageCtx, inp: dict) -> SubmitResult:
        tc = TerrifyContext.model_validate(wf.context or {})
        input_data = InputDict.model_validate(inp)

        actor_id = str(ctx.actor_user_id)
        gm_id = str(ctx.participants.gmUserId)
        is_gm = actor_id == gm_id

        issues = []

        for target in tc.targets:
            owner_id = str(target.userId or "")

            # Каждый игрок обновляет только свои персонажи; ГМ не роллит
            can_roll = not is_gm and owner_id and actor_id == owner_id
            if not can_roll:
                continue

            char_id = str(target.characterId)

            # Уже был бросок — пропускаем, не даём перероллить
            if target.dice is not None:
                continue

            spent = int(input_data.spentStability.get(char_id, 0))
            spent = max(0, spent)

            die = random.randint(1, 6)
            total = die + spent
            passed = total > 4

            target.dice = die
            target.spent_stability = spent
            target.total = total
            target.passed = passed
            target.stability_loss = 0 if passed else tc.damage
            target.canvas_seed = input_data.seeds.get(char_id) or None

        all_rolled = all(t.dice is not None for t in tc.targets)

        wf.context = tc.model_dump(mode="json")

        if all_rolled:
            wf.stageKey = TerrifyResultStage.key

        return ctx.rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=issues,
        )
