from __future__ import annotations

from typing import List

from plugins.common.protocols import ResultBuilder, StageCtx, issue
from plugins.common.types import (
    ActionContext,
    ActionInfo,
    ActionParticipants,
    ActionRole,
    SceneContext,
    SubmitResult,
    Workflow,
)

from .helpers import uniq
from .stages import (
    PerformMoveAidStage,
    PerformMoveApplyStage,
    PerformMoveChooseStage,
    PerformMoveDeclareStage,
    PerformMoveResolveStage,
    PerformMoveResultStage,
    PerformMoveRollStage,
    PerformMoveSetupStage,
)
from .types import PerformMoveContext, PerformMoveEntry
from .wizard import attach_wizard_state, mark_stage_visited
from .stage_draft import draft_patch_result


class PerformMoveWorkflow:
    key = "perform_move"

    def __init__(self, full_codex):
        self.full_codex = full_codex
        self._stages = {
            PerformMoveSetupStage.key: PerformMoveSetupStage(self.full_codex),
            PerformMoveDeclareStage.key: PerformMoveDeclareStage(self.full_codex),
            PerformMoveAidStage.key: PerformMoveAidStage(self.full_codex),
            PerformMoveRollStage.key: PerformMoveRollStage(self.full_codex),
            PerformMoveResolveStage.key: PerformMoveResolveStage(self.full_codex),
            PerformMoveChooseStage.key: PerformMoveChooseStage(self.full_codex),
            PerformMoveApplyStage.key: PerformMoveApplyStage(self.full_codex),
            PerformMoveResultStage.key: PerformMoveResultStage(self.full_codex),
        }
        self._rb = ResultBuilder(self._visible_ids, self._participants_fallback_ids)

    def actions_for(self, scene: SceneContext, role: ActionRole) -> List[ActionInfo]:
        if role not in ("player", "gm"):
            return []
        return [ActionInfo(
            key=self.key,
            title="Perform move",
            roles=["player", "gm"],
            description="Resolve a PbtA move with roll, choices, effects, and result",
        )]

    def _participants_fallback_ids(self, d):
        ids = []
        if gm := (d or {}).get("gmUserId"):
            ids.append(str(gm))
        for u in (d or {}).get("participants") or []:
            ids.append(str(u))
        return uniq(ids)

    def _visible_ids(self, participants: ActionParticipants, wf: Workflow) -> List[str]:
        gm_id = str(participants.gmUserId)

        try:
            c = PerformMoveContext.model_validate(wf.context or {})
            actor_uid = str(c.entry.actor_user_id)
            helper_uid = str(c.entry.aid.helper_user_id) if c.entry.aid.helper_user_id else None
        except Exception:
            actor_uid = None
            helper_uid = None

        stage = wf.stageKey if wf else None

        if stage == PerformMoveSetupStage.key:
            return uniq([gm_id])

        if stage in (
            PerformMoveDeclareStage.key,
            PerformMoveAidStage.key,
            PerformMoveRollStage.key,
            PerformMoveChooseStage.key,
        ):
            return uniq([gm_id, actor_uid, helper_uid])

        if stage in (
            PerformMoveResolveStage.key,
            PerformMoveApplyStage.key,
            PerformMoveResultStage.key,
            "completed",
        ):
            return uniq([gm_id, actor_uid, helper_uid])

        return uniq([gm_id, actor_uid, helper_uid])

    def start(self, action_context: ActionContext) -> SubmitResult:
        participants_dict = action_context.participants.model_dump(mode="json")
        participants = ActionParticipants.model_validate(participants_dict)

        wf = Workflow(
            actionKey=self.key,
            stageKey=PerformMoveSetupStage.key,
            status="active",
            context=PerformMoveContext(
                scene_id=action_context.scene.id,
                entry=PerformMoveEntry(
                    actor_user_id=action_context.actorUserId,
                    **self.full_codex.skills.as_config(),
                    ),
            ).model_dump(mode="json"),
        )

        return self._rb.result(
            ok=True,
            wf=wf,
            participants=participants,
            participants_dict_fallback=participants_dict,
            issues=[],
        )

    def submit(self, action_context: ActionContext) -> SubmitResult:
        wf = action_context.workflow
        if wf is None:
            return self._rb.result(
                ok=False,
                wf=None,
                participants=None,
                participants_dict_fallback=action_context.participants.model_dump(mode="json"),
                issues=[issue("workflow", "Missing")],
            )

        participants_dict = action_context.participants.model_dump(mode="json")
        participants = ActionParticipants.model_validate(participants_dict)

        stage = self._stages.get(wf.stageKey)
        if not stage:
            return self._rb.result(
                ok=False,
                wf=wf,
                participants=participants,
                participants_dict_fallback=participants_dict,
                issues=[issue("", "Unknown stage")],
            )

        old_key = wf.stageKey
        ctx = StageCtx(
            scene=action_context.scene,
            actor_user_id=action_context.actorUserId,
            participants=participants,
            participants_dict=participants_dict,
            rb=self._rb,
            links=action_context.links,
        )
        result = stage.submit(wf, ctx, action_context.input or {})
        if result.ok and result.workflow is not None:
            if old_key:
                mark_stage_visited(result.workflow, old_key)
            try:
                c = PerformMoveContext.model_validate(result.workflow.context or {})
                attach_wizard_state(result.workflow, c)
            except Exception:
                pass
        return result

    def patch(self, action_context: ActionContext) -> SubmitResult:
        wf = action_context.workflow
        if wf is None:
            return self._rb.result(
                ok=False,
                wf=None,
                participants=None,
                participants_dict_fallback=action_context.participants.model_dump(mode="json"),
                issues=[issue("workflow", "Missing")],
            )

        participants_dict = action_context.participants.model_dump(mode="json")
        participants = ActionParticipants.model_validate(participants_dict)

        stage = self._stages.get(wf.stageKey)
        prev_stage = wf.stageKey
        ctx = StageCtx(
            scene=action_context.scene,
            actor_user_id=action_context.actorUserId,
            participants=participants,
            participants_dict=participants_dict,
            rb=self._rb,
            links=action_context.links,
        )

        if stage is not None and hasattr(stage, "patch"):
            result = stage.patch(wf, ctx, action_context.input or {})
        else:
            result = draft_patch_result(wf, ctx, wf.stageKey or "", action_context.input or {})

        if result.ok and result.workflow is not None:
            result.workflow.stageKey = prev_stage
            try:
                c = PerformMoveContext.model_validate(result.workflow.context or {})
                attach_wizard_state(result.workflow, c)
            except Exception:
                pass
        return result