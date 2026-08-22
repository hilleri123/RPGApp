from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from plugins.common.protocols import StageCtx
from plugins.common.protocols.workflow_stage import StageOutcome, issue
from plugins.common.types import ActionParticipants, SubmitResult, Workflow

from ..helpers import collect_participating_factories, damage_quick_options, moves_map_for_workflow, primary_move_id
from ..manifest_sync import (
    STAGE_KEY,
    claims_need_roll,
    prefill_manifest_from_entry,
    read_manifest,
    sync_claims_to_manifest_lines,
    sync_manifest_lines_to_entry,
    write_manifest,
)
from ..stage_store import DwStage
from ..types import PerformMoveContext
from ..types_change_manifest import ChangeManifestState


class ManifestPatchInput(BaseModel):
    mode: str | None = None
    lines: list[dict[str, Any]] | None = None
    editing_line_id: str | None = None
    editing_step: str | None = None
    unprepare_cast_spell: bool | None = None


class ManifestSubmitInput(BaseModel):
    action: str = "continue"  # continue | apply
    lines: list[dict[str, Any]] | None = None
    mode: str | None = None
    unprepare_cast_spell: bool | None = None


class PerformMoveChangeManifestStage(DwStage):
    key = STAGE_KEY

    def _clear_entry_slice(self, entry: Any, wf: Workflow | None = None) -> None:
        if wf is not None:
            write_manifest(wf, ChangeManifestState())

    def validate_patch(self, wf: Workflow, ctx: StageCtx, raw: dict[str, Any]) -> StageOutcome:
        parsed = ctx.rb.parse_input(ManifestPatchInput, raw, wf, ctx)
        if isinstance(parsed, SubmitResult):
            return StageOutcome(ok=False, issues=parsed.issues)

        cur = read_manifest(wf).model_dump(mode="json")
        if parsed.mode is not None:
            cur["mode"] = parsed.mode
        if parsed.lines is not None:
            cur["lines"] = list(parsed.lines)
        if parsed.editing_line_id is not None:
            cur["editing_line_id"] = parsed.editing_line_id or None
        if parsed.editing_step is not None:
            cur["editing_step"] = parsed.editing_step or None
        if parsed.unprepare_cast_spell is not None:
            cur["unprepare_cast_spell"] = bool(parsed.unprepare_cast_spell)
        return StageOutcome.ok_data(cur)

    def apply_patch(self, wf: Workflow, ctx: StageCtx, data: dict[str, Any]) -> None:
        # Drop fields that belong on entry, not ChangeManifestState
        manifest_data = {k: v for k, v in data.items() if k != "unprepare_cast_spell"}
        write_manifest(wf, ChangeManifestState.model_validate(manifest_data))
        if data.get("unprepare_cast_spell") is not None:
            try:
                c = self._context(wf)
                c.entry.unprepare_cast_spell = bool(data["unprepare_cast_spell"])
                wf.context = c.model_dump(mode="json")
            except Exception:
                pass

    def validate_submit(self, wf: Workflow, ctx: StageCtx, raw: dict[str, Any]) -> StageOutcome:
        parsed = ctx.rb.parse_input(ManifestSubmitInput, raw, wf, ctx)
        if isinstance(parsed, SubmitResult):
            return StageOutcome(ok=False, issues=parsed.issues)
        data = {"action": parsed.action, "mode": parsed.mode}
        if parsed.lines is not None:
            data["lines"] = list(parsed.lines)
        if parsed.unprepare_cast_spell is not None:
            data["unprepare_cast_spell"] = bool(parsed.unprepare_cast_spell)
        return StageOutcome.ok_data(data)

    def submit(self, wf: Workflow, ctx: StageCtx, data: dict[str, Any]) -> SubmitResult:
        def err(field: str, msg: str) -> SubmitResult:
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue(field, msg)],
            )

        try:
            c = self._context(wf)
        except Exception as e:
            return err("context", str(e))

        validation = self.validate_submit(wf, ctx, data)
        if not validation.ok:
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=validation.issues,
            )

        payload = validation.data
        if payload.get("unprepare_cast_spell") is not None:
            c.entry.unprepare_cast_spell = bool(payload["unprepare_cast_spell"])
            wf.context = c.model_dump(mode="json")

        if payload.get("lines") is not None:
            write_manifest(
                wf,
                ChangeManifestState.model_validate({
                    **read_manifest(wf).model_dump(mode="json"),
                    "lines": payload["lines"],
                    "mode": payload.get("mode") or read_manifest(wf).mode,
                }),
            )

        prefill_manifest_from_entry(wf, c)
        c = PerformMoveContext.model_validate(wf.context or {})
        mode = str(payload.get("mode") or read_manifest(wf).mode or "edit")
        action = str(payload.get("action") or "continue")

        sync_manifest_lines_to_entry(wf, c, ctx.scene, mode=mode)
        c = PerformMoveContext.model_validate(wf.context or {})
        if payload.get("unprepare_cast_spell") is not None:
            c.entry.unprepare_cast_spell = bool(payload["unprepare_cast_spell"])
            wf.context = c.model_dump(mode="json")

        wf.stageData = {
            **(wf.stageData or {}),
            "damageQuickOptions": damage_quick_options(ctx.scene),
            "manifestAction": action,
            "manifestMode": mode,
        }

        move_id = primary_move_id(c.entry)
        moves_map = moves_map_for_workflow(wf, self.full_codex, c=c)
        factories = collect_participating_factories(c.entry, moves_map, ctx.scene)
        wf.stageData["resourceFactories"] = factories
        wf.stageData["grantTemplates"] = factories

        if action == "apply":
            wf.stageData["manifestNext"] = "apply"
        elif mode == "edit" and action == "continue":
            if claims_need_roll(c):
                wf.stageData["manifestNext"] = "damage_roll"
            else:
                write_manifest(
                    wf,
                    ChangeManifestState.model_validate({
                        **read_manifest(wf).model_dump(mode="json"),
                        "mode": "review",
                    }),
                )
                wf.stageData["manifestNext"] = "review"
        elif mode == "review":
            wf.stageData["manifestNext"] = "apply"
        else:
            wf.stageData["manifestNext"] = "stay"

        sync_claims_to_manifest_lines(wf, c)

        return ctx.rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
        )

    def visibility(self, wf: Workflow, ctx: StageCtx, participants: ActionParticipants) -> list[str]:
        return self._gm_actor_helper_visibility(wf, ctx, participants)

    @staticmethod
    def ensure_initialized(wf: Workflow, c: PerformMoveContext) -> None:
        from ..helpers import default_unprepare_cast_spell

        if c.entry.cast_spell_entry_id:
            c.entry.unprepare_cast_spell = default_unprepare_cast_spell(
                c.entry.roll.outcome if c.entry.roll else None
            )
            wf.context = c.model_dump(mode="json")
        prefill_manifest_from_entry(wf, c)
