# stages/assign_stage.py
from __future__ import annotations
from typing import Any
from uuid import UUID
from pydantic import BaseModel
from plugins.common.types import Workflow, SubmitResult
from plugins.common.protocols import StageCtx, BaseStage, issue
from ..types import InvestigateContext, InvestigateEntry
from ....types import ObstacleData

from .spend_loop import SpendLoopStage


class AssignInput(BaseModel):
    character_id: UUID
    obstacle_id: UUID


class AssignStage(BaseStage):
    key = "gumshoe.investigate.assign"
    def __init__(self, full_codex):
        super().__init__(full_codex)

    def submit(self, wf: Workflow, ctx: StageCtx, input_dict: dict[str, Any]) -> SubmitResult:
        if ctx.actor_user_id != ctx.participants.gmUserId:
            return ctx.rb.result(
                ok=False, wf=wf, participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("", "Only GM can assign")],
            )

        try:
            c = InvestigateContext.model_validate(wf.context or {})
        except Exception as e:
            return ctx.rb.result(
                ok=False, wf=wf, participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("context", str(e))],
            )

        parsed = ctx.rb.parse_input(AssignInput, input_dict, wf, ctx)
        if isinstance(parsed, SubmitResult):
            return parsed

        # --- персонаж ---
        char = next(
            (ch for ch in (ctx.scene.characters or []) if ch.id == parsed.character_id),
            None,
        )
        if char is None:
            return ctx.rb.result(
                ok=False, wf=wf, participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("character_id", "Character not found in scene")],
            )

        owner = ctx.links.characterToUserId.get(parsed.character_id)
        if owner is None:
            return ctx.rb.result(
                ok=False, wf=wf, participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("character_id", "Character has no owner")],
            )

        # --- препятствие ---
        obstacle_raw = next(
            (o for o in (ctx.scene.obstacles or []) if o.id == parsed.obstacle_id),
            None,
        )
        if obstacle_raw is None:
            return ctx.rb.result(
                ok=False, wf=wf, participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("obstacle_id", "Obstacle not found in scene")],
            )

        obstacle = ObstacleData.model_validate(obstacle_raw.data)

        # --- обновляем контекст ---
        entry = InvestigateEntry(
            playerUserId=owner,
            characterId=parsed.character_id,
            obstacle_id=parsed.obstacle_id,
        )

        c.entry = entry
        c.obstacle = obstacle_raw.data
        wf.context = c.model_dump(mode="json")
        wf.stageKey = SpendLoopStage.key
        try:
            # wf.tags.remove("hidden")
            pass
        except:
            pass

        return ctx.rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
        )
