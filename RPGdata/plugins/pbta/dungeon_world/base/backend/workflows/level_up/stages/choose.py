from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from plugins.common.protocols import StageCtx, BaseStage, issue
from plugins.common.types import SubmitResult, Workflow

from ..helpers import can_level_up, xp_cost_for_level
from ..types import LevelUpContext


class ChooseInput(BaseModel):
    stat_id: str = Field(min_length=1)
    move_id: str = Field(min_length=1)


class LevelUpChooseStage(BaseStage):
    """Player-only draft: pick +1 stat and an advanced move, then hand off to GM."""

    key = "level_up.choose"

    def __init__(self, full_codex):
        super().__init__(full_codex)

    def submit(self, wf: Workflow, ctx: StageCtx, input_dict: dict[str, Any]) -> SubmitResult:
        try:
            c = LevelUpContext.model_validate(wf.context or {})
        except Exception as e:
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("context", str(e))],
            )

        uid = str(ctx.actor_user_id)
        if uid != str(c.entry.player_user_id):
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("", "Only the character's player can submit the level-up draft")],
            )

        try:
            parsed = ChooseInput.model_validate(input_dict or {})
        except Exception as e:
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("input", str(e))],
            )

        ch = next(
            (x for x in (ctx.scene.characters or []) if str(x.id) == str(c.entry.character_id)),
            None,
        )
        if ch is None or not isinstance(ch.data, dict):
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("character", "Character not found in scene")],
            )

        if not can_level_up(ch.data):
            level = int(ch.data.get("level") or 1)
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue(
                    "xp",
                    f"Not enough XP (need {xp_cost_for_level(level)}, have {int(ch.data.get('xp') or 0)})",
                )],
            )

        move_id = str(parsed.move_id).strip()
        c.entry.chosen_stat_id = parsed.stat_id
        c.entry.chosen_move_id = move_id
        c.entry.custom_move = None
        c.entry.gm_comment = ""
        c.entry.summary = (
            f"{c.entry.character_name or 'Персонаж'}: черновик — "
            f"+1 {parsed.stat_id}, ход {move_id}"
        )
        wf.context = c.model_dump(mode="json")
        wf.stageKey = "level_up.review"
        wf.status = "active"
        wf.stageData = {
            **(wf.stageData or {}),
            "summary": c.entry.summary,
            "stat_id": parsed.stat_id,
            "move_id": move_id,
            "awaitingGm": True,
        }

        return ctx.rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
        )
