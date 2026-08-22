from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from plugins.common.protocols import StageCtx, BaseStage, issue
from plugins.common.types import SubmitResult, Workflow
from plugins.pbta.base.backend.types import CustomMove

from ..helpers import apply_level_up, can_level_up, xp_cost_for_level
from ..types import LevelUpContext


class ReviewInput(BaseModel):
    decision: str  # approve | reject
    comment: str = ""
    stat_id: str = ""
    move_id: str = ""
    custom_move: dict | None = None


class LevelUpReviewStage(BaseStage):
    """GM validation / refinement. Visible to player + GM."""

    key = "level_up.review"

    def __init__(self, full_codex):
        super().__init__(full_codex)

    def submit(self, wf: Workflow, ctx: StageCtx, input_dict: dict[str, Any]) -> SubmitResult:
        if str(ctx.actor_user_id) != str(ctx.participants.gmUserId):
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("", "Only GM can approve or return a level-up")],
            )

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

        try:
            parsed = ReviewInput.model_validate(input_dict or {})
        except Exception as e:
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("input", str(e))],
            )

        if parsed.decision not in ("approve", "reject"):
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("decision", "decision must be approve or reject")],
            )

        c.entry.gm_comment = parsed.comment or ""

        if parsed.decision == "reject":
            wf.context = c.model_dump(mode="json")
            wf.stageKey = "level_up.choose"
            wf.status = "active"
            wf.stageData = {
                **(wf.stageData or {}),
                "awaitingGm": False,
                "gmComment": c.entry.gm_comment,
            }
            return ctx.rb.result(
                ok=True,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[],
            )

        # approve — allow GM to refine choices
        stat_id = str(parsed.stat_id or c.entry.chosen_stat_id or "").strip()
        custom_raw = parsed.custom_move if isinstance(parsed.custom_move, dict) else c.entry.custom_move
        if custom_raw is not None:
            try:
                cm = CustomMove.model_validate(custom_raw)
            except Exception as e:
                return ctx.rb.result(
                    ok=False,
                    wf=wf,
                    participants=ctx.participants,
                    participants_dict_fallback=ctx.participants_dict,
                    issues=[issue("custom_move", str(e))],
                )
            if not str(cm.title or "").strip():
                return ctx.rb.result(
                    ok=False,
                    wf=wf,
                    participants=ctx.participants,
                    participants_dict_fallback=ctx.participants_dict,
                    issues=[issue("custom_move", "Custom move title is required")],
                )
            custom_raw = cm.model_dump(mode="json")
            move_id = cm.id
        else:
            custom_raw = None
            move_id = str(parsed.move_id or c.entry.chosen_move_id or "").strip()

        if not stat_id or not move_id:
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("choice", "stat_id and move_id are required to approve")],
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

        try:
            updated = apply_level_up(
                self.full_codex,
                ch.data,
                stat_id=stat_id,
                move_id=move_id,
                custom_move=custom_raw,
                allow_custom=bool(custom_raw),
            )
        except ValueError as e:
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("choice", str(e))],
            )

        granted_move_id = str(custom_raw.get("id") if custom_raw else move_id)
        move_label = (
            str(custom_raw.get("title") or granted_move_id)
            if custom_raw
            else granted_move_id
        )
        c.entry.chosen_stat_id = stat_id
        c.entry.chosen_move_id = granted_move_id
        c.entry.custom_move = custom_raw
        c.entry.level = int(updated.get("level") or c.entry.level)
        c.entry.xp = int(updated.get("xp") or 0)
        c.entry.summary = (
            f"{c.entry.character_name or 'Персонаж'} → ур. {c.entry.level}: "
            f"+1 {stat_id}, ход {move_label}"
        )
        wf.context = c.model_dump(mode="json")
        wf.stageKey = "level_up.result"
        wf.status = "completed"
        wf.stageData = {
            **(wf.stageData or {}),
            "summary": c.entry.summary,
            "level": c.entry.level,
            "xp": c.entry.xp,
            "stat_id": stat_id,
            "move_id": granted_move_id,
            "custom": bool(custom_raw),
            "awaitingGm": False,
        }

        return ctx.rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
            sessionPatch={
                "characters": [{"id": str(c.entry.character_id), "dataPatch": updated}],
            },
        )
