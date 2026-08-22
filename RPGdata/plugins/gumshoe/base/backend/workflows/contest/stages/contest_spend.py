# plugins/gumshoe/contest/stages/contest_spend.py
from __future__ import annotations
from typing import Any
from pydantic import BaseModel, NonNegativeInt

from plugins.common.types import Workflow, SubmitResult
from plugins.common.protocols import StageCtx, BaseStage, issue
from ..types import ContestContext, ContestSide
from ....types import CharacterData, NpcData


class ContestSpendInput(BaseModel):
    skill_points: NonNegativeInt


class ContestSpendStage(BaseStage):
    key = "gumshoe.contest.spend"
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

        parsed = ctx.rb.parse_input(ContestSpendInput, input_dict, wf, ctx)
        if isinstance(parsed, SubmitResult):
            return parsed

        entry = c.entry
        actor = ctx.actor_user_id
        is_gm = actor == ctx.participants.gmUserId

        # Определяем, чья это сторона
        side_key = _side_for_actor(entry, actor, is_gm)
        if side_key is None:
            return err("", "You are not a participant in this contest")

        side = entry.side_a if side_key == "a" else entry.side_b

        # Проверяем, что ещё не указал
        if side.points_set:
            return err("", "You already set skill points for this round")

        # Валидация: не больше, чем есть
        available = _available_points(side, entry.skill_id, ctx.scene)
        if parsed.skill_points > available:
            return err("skill_points",
                       f"Only {available} pts available for {entry.skill_id}")

        side.skill_points = parsed.skill_points
        side.points_set   = True

        c.entry = entry
        wf.context = c.model_dump(mode="json")

        # Если оба указали — переходим к броску
        if entry.side_a.points_set and entry.side_b.points_set:
            wf.stageKey = "gumshoe.contest.roll"

        return ctx.rb.result(ok=True, wf=wf, participants=ctx.participants,
                             participants_dict_fallback=ctx.participants_dict,
                             issues=[])


def _side_for_actor(entry, actor_id, is_gm) -> ContestSide | None:
    """Возвращает 'a' или 'b' в зависимости от того, кто подаёт."""
    def owns(side) -> bool:
        if side.userId and str(side.userId) == str(actor_id):
            return True
        # NPC (нет userId) — управляет GM
        if side.npcId and is_gm:
            return True
        # GM за сторону без участника
        if not side.characterId and not side.npcId and is_gm:
            return True
        return False

    if not entry.side_a.points_set and owns(entry.side_a):
        return "a"
    if not entry.side_b.points_set and owns(entry.side_b):
        return "b"
    return None


def _available_points(side, skill_id: str, scene) -> int:
    if side.characterId:
        char = next((ch for ch in (scene.characters or []) if ch.id == side.characterId), None)
        if char is None:
            return 0
        data = CharacterData.model_validate(char.data)
        return data.skills.get(skill_id, 0)
    if side.npcId:
        npc = next((n for n in (scene.npcs or []) if n.id == side.npcId), None)
        if npc is None:
            return 0
        data = NpcData.model_validate(npc.data)
        return data.skills.get(skill_id, 0)
    return 0
