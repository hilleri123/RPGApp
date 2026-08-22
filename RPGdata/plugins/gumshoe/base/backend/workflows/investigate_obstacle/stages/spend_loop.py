# plugins/gumshoe/investigate_obstacle/stages/spend_loop.py
from __future__ import annotations
from typing import Any, Optional, Literal
from pydantic import BaseModel
from plugins.common.types import Workflow, SubmitResult, SceneContext
from plugins.common.protocols import StageCtx, BaseStage, issue
from ..types import InvestigateContext, SpendRecord
from ....types import ObstacleData, CharacterData


class SpendLoopInput(BaseModel):
    action: Literal["request_spend", "finish"]
    # заполняется только при action="request_spend"
    clue_spend_name: Optional[str] = None
    skill_name: Optional[str] = None       # игрок может указать другой скилл


class SpendLoopStage(BaseStage):
    key = "gumshoe.investigate.spend_loop"
    def __init__(self, full_codex):
        super().__init__(full_codex)

    def submit(self, wf: Workflow, ctx: StageCtx, input_dict: dict[str, Any]) -> SubmitResult:
        try:
            c = InvestigateContext.model_validate(wf.context or {})
        except Exception as e:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants,
                                 participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("context", str(e))])

        parsed = ctx.rb.parse_input(SpendLoopInput, input_dict, wf, ctx)
        if isinstance(parsed, SubmitResult):
            return parsed

        entry = c.entry
        if entry.playerUserId != ctx.actor_user_id:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants,
                                 participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("", "Only the player can act here")])

        if parsed.action == "finish":
            entry.finished = True
            c.entry = entry
            wf.context = c.model_dump(mode="json")
            wf.stageKey = "gumshoe.investigate.result"
            return ctx.rb.result(ok=True, wf=wf, participants=ctx.participants,
                                 participants_dict_fallback=ctx.participants_dict, issues=[])

        # action == "request_spend"
        if not parsed.clue_spend_name:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants,
                                 participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("clue_spend_name", "Required for request_spend")])

        # берём препятствие
        obstacle = c.obstacle

        spend_def = next((s for s in obstacle.spends if s.name == parsed.clue_spend_name), None)
        if spend_def is None:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants,
                                 participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("clue_spend_name", "Unknown spend")])

        # нельзя купить то, что уже куплено
        already = any(r.clue_spend_name == parsed.clue_spend_name and r.confirmed
                      for r in entry.spend_records)
        if already:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants,
                                 participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("clue_spend_name", "Already purchased")])

        skill_to_use = parsed.skill_name or entry.chosen_skill

        # проверяем достаточность очков (текущие - уже запрошенные)
        char = next((ch for ch in (ctx.scene.characters or []) if ch.id == entry.characterId), None)
        char_data = CharacterData.model_validate(char.data) if char else CharacterData()
        available = char_data.skills.get(skill_to_use, 0)

        already_spent = sum(
            r.cost for r in entry.spend_records
            if r.skill_name == skill_to_use and r.confirmed
        )
        if available - already_spent < spend_def.cost:
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants,
                                 participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue("skill_name", "Not enough points")])

        # добавляем pending-запись
        entry.spend_records.append(SpendRecord(
            clue_spend_name=spend_def.name,
            skill_name=skill_to_use,
            cost=spend_def.cost,
            info=spend_def.info,
            confirmed=False,
            revealed=False,
        ))

        c.entry = entry
        wf.context = c.model_dump(mode="json")
        wf.stageKey = "gumshoe.investigate.gm_confirm"
        wf.tags.append("hidden")

        return ctx.rb.result(ok=True, wf=wf, participants=ctx.participants,
                             participants_dict_fallback=ctx.participants_dict, issues=[])
