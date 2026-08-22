# plugins/gumshoe/contest/stages/contest_result.py
from __future__ import annotations
from typing import Any, Optional, Literal
from pydantic import BaseModel

from plugins.common.types import Workflow, SubmitResult
from plugins.common.protocols import StageCtx, BaseStage, issue
from ..types import ContestContext, ContestRound, ContestSide, ContestParticipant
import copy


class ContestResultInput(BaseModel):
    # "a" | "b" | "draw" — кто победил в этом раунде
    round_winner: Literal["a", "b", "draw"]
    # что дальше
    action: Literal["next_round", "finish"]
    # если finish — итоговый победитель (опционально, иначе = round_winner)
    final_winner: Optional[Literal["a", "b", "draw"]] = None


class ContestResultStage(BaseStage):
    key = "gumshoe.contest.result"
    def __init__(self, full_codex):
        super().__init__(full_codex)

    def submit(self, wf: Workflow, ctx: StageCtx, input_dict: dict[str, Any]) -> SubmitResult:
        def err(f, m):
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants,
                                 participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue(f, m)])

        if ctx.actor_user_id != ctx.participants.gmUserId:
            return err("", "Only GM can resolve contest result")

        try:
            c = ContestContext.model_validate(wf.context or {})
        except Exception as e:
            return err("context", str(e))

        parsed = ctx.rb.parse_input(ContestResultInput, input_dict, wf, ctx)
        if isinstance(parsed, SubmitResult):
            return parsed

        entry = c.entry
        a, b  = entry.side_a, entry.side_b

        # Текст результата раунда
        a_total = a.roll_total or 0
        b_total = b.roll_total or 0
        winner_name = (
            a.name if parsed.round_winner == "a" else
            b.name if parsed.round_winner == "b" else "Ничья"
        )
        result_text = (
            f"Раунд {entry.current_round}: "
            f"{a.name} {a_total} ({a.skill_points} pts + {(a.dice or [0])[0]}) vs "
            f"{b.name} {b_total} ({b.skill_points} pts + {(b.dice or [0])[0]}) — "
            f"победитель: {winner_name}"
        )

        # Сохраняем раунд в историю
        round_rec = ContestRound(
            round_num    = entry.current_round,
            skill_id     = entry.skill_id,
            side_a       = copy.deepcopy(a),
            side_b       = copy.deepcopy(b),
            winner       = parsed.round_winner if parsed.round_winner != "draw" else None,
            result_text  = result_text,
        )
        entry.rounds.append(round_rec)

        if parsed.action == "next_round":
            # Сбрасываем состояние сторон для нового раунда
            entry.side_a = _reset_for_next_round(a)
            entry.side_b = _reset_for_next_round(b)
            entry.current_round += 1

            c.entry = entry
            wf.context = c.model_dump(mode="json")
            wf.stageKey = "gumshoe.contest.spend"

        else:  # finish
            entry.final_winner = parsed.final_winner or (
                parsed.round_winner if parsed.round_winner != "draw" else None
            )
            c.entry = entry
            wf.context = c.model_dump(mode="json")
            wf.stageKey  = "completed"
            wf.status    = "completed"

        return ctx.rb.result(ok=True, wf=wf, participants=ctx.participants,
                             participants_dict_fallback=ctx.participants_dict,
                             issues=[])


def _reset_for_next_round(p: ContestParticipant) -> ContestParticipant:
    return ContestParticipant(
        characterId  = p.characterId,
        npcId        = p.npcId,
        name         = p.name,
        userId       = p.userId,
        difficulty   = p.difficulty,
        # поинты и бросок сбрасываются
        skill_points = 0,
        points_set   = True if (not p.characterId and not p.npcId) else False,
        canvas_seed  = None,
        dice         = None,
        roll_total   = None,
        passed       = None,
    )
