from __future__ import annotations

from typing import Any
from uuid import UUID

from pydantic import BaseModel

from plugins.common.protocols import StageCtx
from plugins.common.protocols.workflow_stage import StageOutcome, issue
from plugins.common.types import ActionParticipants, SubmitResult, Workflow
from plugins.pbta.base.backend.workflows.perform_move.helpers import attach_roll_stage_data
from plugins.pbta.base.backend.workflows.perform_move.types import AidState

from ..stage_store import DwStage


class AidInput(BaseModel):
    request_aid: bool = False
    helper_character_id: UUID | None = None
    accept: bool | None = None


class AidPatchInput(BaseModel):
    request_aid: bool | None = None
    helper_character_id: UUID | None = None
    accept: bool | None = None


class PerformMoveAidStage(DwStage):
    key = "perform_move.aid"

    def _clear_entry_slice(self, entry: Any, wf: Workflow | None = None) -> None:
        entry.aid = AidState()
        entry.roll.aid_bonus = 0

    def validate_patch(self, wf: Workflow, ctx: StageCtx, raw: dict[str, Any]) -> StageOutcome:
        cur = dict(self.get(wf))
        parsed = ctx.rb.parse_input(AidPatchInput, raw, wf, ctx)
        if isinstance(parsed, SubmitResult):
            return StageOutcome(ok=False, issues=parsed.issues)
        if parsed.request_aid is not None:
            cur["request_aid"] = bool(parsed.request_aid)
            if not parsed.request_aid:
                cur["helper_character_id"] = None
                cur["accept"] = None
        if parsed.helper_character_id is not None:
            cur["helper_character_id"] = str(parsed.helper_character_id)
        if parsed.accept is not None:
            cur["accept"] = bool(parsed.accept)
        return StageOutcome.ok_data(cur)

    def apply_patch(self, wf: Workflow, ctx: StageCtx, data: dict[str, Any]) -> None:
        self.put(wf, data)

    def assemble(self, wf: Workflow, ctx: StageCtx, entry: Any) -> None:
        data = self.get(wf)
        if not data:
            return
        requested = bool(data.get("request_aid"))
        entry.aid.requested = requested
        if not requested:
            entry.aid.helper_user_id = None
            entry.aid.helper_character_id = None
            entry.aid.accepted = None
            entry.aid.bonus_amount = 0
            entry.roll.aid_bonus = 0
            return

        helper_id = data.get("helper_character_id")
        if helper_id:
            helper = next(
                (x for x in (ctx.scene.characters or []) if str(x.id) == str(helper_id)),
                None,
            )
            if helper:
                helper_uid = ctx.links.characterToUserId.get(helper.id)
                entry.aid.helper_character_id = helper.id
                entry.aid.helper_user_id = helper_uid
        if data.get("accept") is not None:
            entry.aid.accepted = bool(data["accept"])
        entry.aid.bonus_amount = 1 if entry.aid.accepted else 0
        entry.roll.aid_bonus = entry.aid.bonus_amount

    def validate_submit(self, wf: Workflow, ctx: StageCtx, raw: dict[str, Any]) -> StageOutcome:
        try:
            c = self._context(wf)
        except Exception as e:
            return StageOutcome.fail("context", str(e))

        if c.entry.actor_kind != "character":
            return StageOutcome.ok_data({})

        if not self._actor_or_gm(ctx, c):
            return StageOutcome.fail("", "Only actor or GM can decide aid")

        parsed = ctx.rb.parse_input(AidInput, raw, wf, ctx)
        if isinstance(parsed, SubmitResult):
            return StageOutcome(ok=False, issues=parsed.issues)

        data: dict[str, Any] = {"request_aid": bool(parsed.request_aid)}
        if not parsed.request_aid:
            return StageOutcome.ok_data({
                "request_aid": False,
                "helper_character_id": None,
                "accept": None,
            })

        if parsed.helper_character_id is None:
            return StageOutcome.fail("helper_character_id", "Helper is required")

        helper = next(
            (x for x in (ctx.scene.characters or []) if x.id == parsed.helper_character_id),
            None,
        )
        if helper is None:
            return StageOutcome.fail("helper_character_id", "Helper character not found")

        helper_uid = ctx.links.characterToUserId.get(helper.id)
        if helper_uid is None:
            return StageOutcome.fail("helper_character_id", "Helper is not linked to a user")

        data["helper_character_id"] = str(parsed.helper_character_id)
        data["accept"] = bool(parsed.accept)
        return StageOutcome.ok_data(data)

    def submit(self, wf: Workflow, ctx: StageCtx, data: dict[str, Any]) -> SubmitResult:
        try:
            c = self._context(wf)
        except Exception as e:
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("context", str(e))],
            )

        if c.entry.actor_kind != "character":
            return ctx.rb.result(
                ok=True,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[],
            )

        self.put(wf, data)
        self.assemble(wf, ctx, c.entry)
        wf.context = c.model_dump(mode="json")

        return ctx.rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
        )

    def visibility(self, wf: Workflow, ctx: StageCtx, participants: ActionParticipants) -> list[str]:
        return self._gm_actor_helper_visibility(wf, ctx, participants)
