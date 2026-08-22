from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from app.services.roll_service import RollSpec, roll_from_seed
from plugins.common.protocols import StageCtx, issue
from plugins.common.types import SubmitResult, Workflow

from ..types import FreeDiceContext, FreeDiceRollResult
from .result import FreeDiceResultStage

_ROLL_KEY = "common.free_dice_roll.roll"


class RollInput(BaseModel):
    roll_seed: str


class FreeDiceRollStage:
    key = _ROLL_KEY

    def __init__(self, full_codex) -> None:
        self.full_codex = full_codex

    def submit(self, wf: Workflow, ctx: StageCtx, inp: dict[str, Any]) -> SubmitResult:
        fc = FreeDiceContext.model_validate(wf.context or {})
        if str(ctx.actor_user_id) != str(fc.actor_user_id):
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("", "Only initiator can roll")],
            )

        parsed = ctx.rb.parse_input(RollInput, inp, wf, ctx)
        if isinstance(parsed, SubmitResult):
            return parsed

        spec = RollSpec(expression=fc.expression or "1d6", interpreter="generic", layout="combined")
        result = roll_from_seed(parsed.roll_seed, spec)

        fc.roll = FreeDiceRollResult(
            roll_seed=parsed.roll_seed,
            dice=list(result.dice),
            total=int(result.total),
            expression=fc.expression,
        )
        wf.context = fc.model_dump(mode="json")
        # Keep action active so everyone gets a shared result modal.
        wf.stageKey = FreeDiceResultStage.key
        wf.status = "active"

        decl = (fc.declaration or "").strip()
        title = decl[:120] if decl else f"Свободный бросок ({fc.expression})"

        character_id = None
        character_name = None
        for ch in ctx.scene.characters or []:
            uid = (ctx.links.characterToUserId or {}).get(ch.id)
            if uid and str(uid) == str(fc.actor_user_id):
                character_id = str(ch.id)
                character_name = str(ch.name or "")
                break

        meta: dict[str, Any] = {
            "expression": fc.expression,
            "declaration": fc.declaration,
            "seed_hash": result.seed_hash,
        }
        if character_id:
            meta["character_id"] = character_id
        if character_name:
            meta["character_name"] = character_name

        log_events: list[dict[str, Any]] = [
            ctx.rb.log_roll(
                title=title,
                dice=list(result.dice),
                total=int(result.total),
                seed=parsed.roll_seed,
                roll_kind="common.free_dice_roll",
                meta=meta,
            ),
        ]
        if decl:
            log_events.append(
                ctx.rb.log_text(f"Заявка: {decl}", tags=["free_dice_roll"]),
            )

        return ctx.rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
            logEvents=log_events,
            broadcasts=[{
                "type": "dice.roll",
                "rolls": list(result.dice),
                "total": int(result.total),
                "roll_seed": parsed.roll_seed,
                "action": fc.expression,
                "character_name": character_name,
            }],
        )
