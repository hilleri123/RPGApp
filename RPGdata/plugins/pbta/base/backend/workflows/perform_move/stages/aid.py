from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel

from plugins.common.protocols import BaseStage, StageCtx, issue
from plugins.common.types import SubmitResult, Workflow

from ..helpers import attach_roll_stage_data
from ..types import PerformMoveContext


class AidInput(BaseModel):
    request_aid: bool = False
    helper_character_id: Optional[UUID] = None
    accept: Optional[bool] = None


class PerformMoveAidStage(BaseStage):
    key = "perform_move.aid"

    def submit(self, wf: Workflow, ctx: StageCtx, input_dict: dict[str, Any]) -> SubmitResult:
        def err(field: str, msg: str) -> SubmitResult:
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue(field, msg)],
            )

        try:
            c = PerformMoveContext.model_validate(wf.context or {})
        except Exception as e:
            return err("context", str(e))

        parsed = ctx.rb.parse_input(AidInput, input_dict, wf, ctx)
        if isinstance(parsed, SubmitResult):
            return parsed

        if c.entry.actor_kind != "character":
            wf.stageKey = "perform_move.roll" if c.entry.roll.required else "perform_move.resolve"
            if c.entry.roll.required:
                attach_roll_stage_data(wf, c)
            return ctx.rb.result(ok=True, wf=wf, participants=ctx.participants,
                                 participants_dict_fallback=ctx.participants_dict, issues=[])

        if ctx.actor_user_id not in (c.entry.actor_user_id, ctx.participants.gmUserId):
            return err("", "Only actor or GM can decide aid")

        c.entry.aid.requested = parsed.request_aid

        if not parsed.request_aid:
            c.entry.aid.helper_user_id = None
            c.entry.aid.helper_character_id = None
            c.entry.aid.accepted = None
            c.entry.aid.bonus_amount = 0
        else:
            if parsed.helper_character_id is None:
                return err("helper_character_id", "Helper is required")

            helper = next((x for x in (ctx.scene.characters or []) if x.id == parsed.helper_character_id), None)
            if helper is None:
                return err("helper_character_id", "Helper character not found")

            helper_uid = ctx.links.characterToUserId.get(helper.id)
            if helper_uid is None:
                return err("helper_character_id", "Helper is not linked to a user")

            c.entry.aid.helper_character_id = helper.id
            c.entry.aid.helper_user_id = helper_uid
            c.entry.aid.accepted = bool(parsed.accept)
            c.entry.aid.bonus_amount = 1 if parsed.accept else 0

        c.entry.roll.aid_bonus = c.entry.aid.bonus_amount

        wf.context = c.model_dump(mode="json")
        wf.stageKey = "perform_move.roll" if c.entry.roll.required else "perform_move.resolve"
        if c.entry.roll.required:
            attach_roll_stage_data(wf, c)

        return ctx.rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
        )