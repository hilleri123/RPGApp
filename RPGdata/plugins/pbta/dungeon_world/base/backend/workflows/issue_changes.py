"""Отдельное действие: мастер сразу объявляет заявки, кубы кидает игрок."""

from __future__ import annotations

from plugins.common.protocols import StageCtx, issue
from plugins.common.types import ActionContext, ActionInfo, ActionParticipants, ActionRole, SubmitResult, Workflow

from .perform_move.helpers import damage_quick_options
from .perform_move.stages.change_manifest import PerformMoveChangeManifestStage
from .perform_move.types import PerformMoveContext, PerformMoveEntry
from .perform_move.workflow import PerformMoveWorkflow


class IssueChangesWorkflow(PerformMoveWorkflow):
    key = "issue_changes"

    def actions_for(self, scene, role: ActionRole) -> list[ActionInfo]:
        if role != "gm":
            return []
        return [
            ActionInfo(
                key=self.key,
                title="Заявки на изменение",
                roles=["gm"],
                description="Сразу объявить урон, лечение и другие изменения. Кубы кидает игрок.",
            )
        ]

    def start(self, action_context: ActionContext) -> SubmitResult:
        participants_dict = action_context.participants.model_dump(mode="json")
        participants = ActionParticipants.model_validate(participants_dict)
        gm_id = participants.gmUserId
        if str(action_context.actorUserId) != str(gm_id):
            return self._rb.result(
                ok=False,
                wf=Workflow(actionKey=self.key, stageKey="", status="canceled"),
                participants=participants,
                participants_dict_fallback=participants_dict,
                issues=[issue("", "Заявки объявляет только мастер")],
            )

        wf = Workflow(
            actionKey=self.key,
            stageKey="perform_move.post_roll",
            status="active",
            context=PerformMoveContext(
                scene_id=action_context.scene.id,
                entry=PerformMoveEntry(actor_user_id=gm_id),
            ).model_dump(mode="json"),
        )
        ctx = StageCtx(
            scene=action_context.scene,
            actor_user_id=action_context.actorUserId,
            participants=participants,
            participants_dict=participants_dict,
            rb=self._rb,
            links=action_context.links,
        )
        c = PerformMoveContext.model_validate(wf.context or {})
        PerformMoveChangeManifestStage.ensure_initialized(wf, c)
        self._init_wizard_substep(wf, "perform_move.change_manifest")
        c = PerformMoveContext.model_validate(wf.context or {})
        self._attach_wizard(wf, c)
        wf.stageData = {
            **(wf.stageData or {}),
            "damageQuickOptions": damage_quick_options(ctx.scene, self.full_codex),
        }
        return self._rb.result(
            ok=True,
            wf=wf,
            participants=participants,
            participants_dict_fallback=participants_dict,
            issues=[],
        )
