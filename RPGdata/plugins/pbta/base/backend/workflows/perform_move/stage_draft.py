"""Shared draft patch helpers for base perform_move stages."""

from __future__ import annotations

from typing import Any, Callable, Optional

from plugins.common.protocols import StageCtx, issue
from plugins.common.types import SubmitResult, Workflow

from .types import PerformMoveContext
from .wizard import attach_wizard_state, is_stage_readonly


def get_stage_draft(wf: Workflow, stage_key: str) -> dict[str, Any]:
    drafts = wf.stageData.get("drafts") if isinstance(wf.stageData, dict) else None
    if isinstance(drafts, dict) and isinstance(drafts.get(stage_key), dict):
        return dict(drafts[stage_key])
    if stage_key == "perform_move.declare":
        legacy = wf.stageData.get("draft") if isinstance(wf.stageData, dict) else None
        if isinstance(legacy, dict):
            return dict(legacy)
    return {}


def set_stage_draft(wf: Workflow, stage_key: str, draft: dict[str, Any]) -> None:
    stage_data = dict(wf.stageData or {})
    drafts = dict(stage_data.get("drafts") or {})
    drafts[stage_key] = draft
    stage_data["drafts"] = drafts
    if stage_key == "perform_move.declare":
        stage_data["draft"] = draft
    wf.stageData = stage_data


def merge_stage_draft(wf: Workflow, stage_key: str, patch: dict[str, Any]) -> dict[str, Any]:
    cur = get_stage_draft(wf, stage_key)
    cur.update(patch)
    set_stage_draft(wf, stage_key, cur)
    return cur


def can_edit_workflow(ctx: StageCtx, c: PerformMoveContext) -> bool:
    return str(ctx.actor_user_id) in (
        str(c.entry.actor_user_id),
        str(ctx.participants.gmUserId),
    )


def draft_patch_result(
    wf: Workflow,
    ctx: StageCtx,
    stage_key: str,
    input_dict: dict[str, Any],
    *,
    refresh: Optional[Callable[[Workflow, StageCtx, PerformMoveContext, dict[str, Any]], None]] = None,
) -> SubmitResult:
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

    if not can_edit_workflow(ctx, c):
        return err("", "Only actor or GM can edit this stage")

    if is_stage_readonly(wf, c, stage_key):
        return err("", "This stage is frozen and cannot be edited")

    clean = {k: v for k, v in (input_dict or {}).items() if not str(k).startswith("_")}
    draft = merge_stage_draft(wf, stage_key, clean)
    if refresh is not None:
        refresh(wf, ctx, c, draft)

    attach_wizard_state(wf, c)
    return ctx.rb.result(
        ok=True,
        wf=wf,
        participants=ctx.participants,
        participants_dict_fallback=ctx.participants_dict,
        issues=[],
    )
