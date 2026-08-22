# plugins/gumshoe/contest/stages/contest_setup.py
from __future__ import annotations
from typing import Any, Optional
from uuid import UUID
from pydantic import BaseModel

from plugins.common.types import Workflow, SubmitResult
from plugins.common.protocols import StageCtx, issue, BaseStage
from ..types import ContestContext, ContestEntry, ContestParticipant
from ....types import NpcData, CharacterData


class ContestSetupInput(BaseModel):
    skill_id: str

    side_a_character_id: Optional[UUID] = None
    side_a_npc_id:       Optional[UUID] = None
    side_a_difficulty:   int

    side_b_character_id: Optional[UUID] = None
    side_b_npc_id:       Optional[UUID] = None
    side_b_difficulty:   int

    side_b_none:         bool = False   # явно указать «никого» со стороны B


class ContestSetupStage(BaseStage):
    key = "gumshoe.contest.setup"
    def __init__(self, full_codex):
        super().__init__(full_codex)

    def submit(self, wf: Workflow, ctx: StageCtx, input_dict: dict[str, Any]) -> SubmitResult:
        def err(f, m):
            return ctx.rb.result(ok=False, wf=wf, participants=ctx.participants,
                                 participants_dict_fallback=ctx.participants_dict,
                                 issues=[issue(f, m)])

        if ctx.actor_user_id != ctx.participants.gmUserId:
            return err("", "Only GM can setup contest")

        try:
            c = ContestContext.model_validate(wf.context or {})
        except Exception as e:
            return err("context", str(e))

        parsed = ctx.rb.parse_input(ContestSetupInput, input_dict, wf, ctx)
        if isinstance(parsed, SubmitResult):
            return parsed

        if not parsed.skill_id:
            return err("skill_id", "Skill is required")

        scene = ctx.scene

        # ── Сторона A (обязательна) ────────────────────────────────────────────
        side_a = _resolve_participant(
            parsed.side_a_character_id, parsed.side_a_npc_id,
            scene, ctx.links, parsed.side_a_difficulty
        )
        if side_a is None:
            return err("side_a", "Side A participant not found")

        # ── Сторона B (опциональна) ────────────────────────────────────────────
        if parsed.side_b_none:
            side_b = ContestParticipant(name="—", points_set=True)  # авто-готова
        else:
            side_b = _resolve_participant(
                parsed.side_b_character_id, parsed.side_b_npc_id,
                scene, ctx.links, parsed.side_b_difficulty
            )
            if side_b is None:
                return err("side_b", "Side B participant not found")

        entry = ContestEntry(
            skill_id=parsed.skill_id,
            side_a=side_a,
            side_b=side_b,
        )
        c.entry = entry
        wf.context = c.model_dump(mode="json")
        wf.stageKey = "gumshoe.contest.spend"

        return ctx.rb.result(ok=True, wf=wf, participants=ctx.participants,
                             participants_dict_fallback=ctx.participants_dict,
                             issues=[])


def _resolve_participant(
    char_id, npc_id, scene, links, difficulty
) -> ContestParticipant | None:
    if char_id:
        char = next((ch for ch in (scene.characters or []) if ch.id == char_id), None)
        if char is None:
            return None
        user_id = links.characterToUserId.get(char.id)
        return ContestParticipant(
            characterId=char.id,
            name=char.name or "",
            userId=user_id,
            difficulty=difficulty,
        )
    if npc_id:
        npc = next((n for n in (scene.npcs or []) if n.id == npc_id), None)
        if npc is None:
            return None
        return ContestParticipant(npcId=npc.id, name=npc.name or "", difficulty=difficulty)
    return None
