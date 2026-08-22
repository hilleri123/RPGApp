# plugins/gumshoe/attack/stages/attack_roll.py
from __future__ import annotations
from typing import Any, List
import random
from pydantic import BaseModel

from plugins.common.types import Workflow, SubmitResult
from plugins.common.protocols import StageCtx, BaseStage, issue
from ..types import AttackContext
from ....types import NpcData, CharacterData, ItemData


class AttackRollInput(BaseModel):
    canvas_seed: str


class AttackRollStage(BaseStage):
    key = "gumshoe.attack.roll"
    def __init__(self, full_codex):
        super().__init__(full_codex)

    def submit(self, wf: Workflow, ctx: StageCtx, input_dict: dict[str, Any]) -> SubmitResult:
        def err(field, msg):
            return ctx.rb.result(
                ok=False, wf=wf, participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue(field, msg)],
            )

        try:
            c = AttackContext.model_validate(wf.context or {})
        except Exception as e:
            return err("context", str(e))

        parsed = ctx.rb.parse_input(AttackRollInput, input_dict, wf, ctx)
        if isinstance(parsed, SubmitResult):
            return parsed

        entry = c.entry
        is_gm = ctx.actor_user_id == ctx.participants.gmUserId

        # Только атакующий (или GM) может бросать
        if not is_gm and entry.attackerUserId != ctx.actor_user_id:
            return err("", "Only attacker or GM can roll")

        entry.canvas_seed = parsed.canvas_seed
        rng = random.Random(parsed.canvas_seed)
        dice: List[int] = [rng.randint(1, 6)]
        entry.dice = dice
        roll = dice[0]
        attack_value = roll + entry.skill_points

        # Получаем hitThreshold цели
        scene = ctx.scene
        hit_threshold = 4

        if entry.targetNpcId:
            target_npc = next(
                (n for n in (scene.npcs or []) if n.id == entry.targetNpcId), None
            )
            if target_npc is None:
                return err("targetNpcId", "Target NPC not found")
            npc_data = NpcData.model_validate(target_npc.data)
            hit_threshold = npc_data.hitThreshold or 4

        elif entry.targetCharacterId:
            target_character = next(
                (c for c in (scene.characters or []) if c.id == entry.targetCharacterId), None
            )
            if target_character is None:
                return err("targetNpcId", "Target NPC not found")
            character_data = CharacterData.model_validate(target_character.data)
            hit_threshold = character_data.hit_difficulty

        hit = attack_value >= hit_threshold
        entry.result_hit = hit

        target_name = entry.targetNpcName or entry.targetCharacterName or "цель"

        if hit:
            wf.stageKey = "gumshoe.attack.damage"
            entry.result_text = (
                f"Попадание по {target_name}: {attack_value} (≥ {hit_threshold})"
            )
        else:
            wf.stageKey = "gumshoe.attack.result"
            entry.result_text = (
                f"Промах по {target_name}: {attack_value} (< {hit_threshold})"
            )

        c.entry = entry
        wf.context = c.model_dump(mode="json")

        return ctx.rb.result(
            ok=True, wf=wf, participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
        )
