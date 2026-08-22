from __future__ import annotations

from typing import Any
from pydantic import ValidationError

from plugins.common.types import Workflow, StageEnvelope, SubmitResult
from plugins.common.protocols import StageCtx, issue
from ..types_scene_switch_phase import SceneSwitchPhaseContext, SceneSwitchPhaseConfirmInput
from ..utils_scene_switch_phase import get_next_phase, make_snapshot, compute_pending


class SwitchPhaseConfirmStage:
    key = "switch_phase.confirm"

    def _rebuild_context(self, wf: Workflow, ctx: StageCtx) -> SceneSwitchPhaseContext:
        # ctx.scene — модель, обязана быть
        scene = ctx.scene
        data = scene.data

        # Если не combat — всё равно построим контекст “как есть”, но pending/snapshot будут по сцене
        cur_phase = scene.data.combat.phase  
        nxt_phase = get_next_phase(data.combat)

        c = SceneSwitchPhaseContext(
            sceneId=scene.id,
            currentPhase=cur_phase,
            nextPhase=nxt_phase,
            pending=compute_pending(scene),
            snapshot=make_snapshot(scene),
            sceneData=data,  # лучше: SceneData, а не dict
        )
        wf.context = c.model_dump(mode="json")
        return c


    def submit(self, wf: Workflow, ctx: StageCtx, input_dict: dict[str, Any]) -> SubmitResult:
        # only GM
        print(ctx)
        if ctx.participants.gmUserId != ctx.actor_user_id:
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("", "Only GM can switch combat phase")],
            )

        parsed = ctx.rb.parse_input(SceneSwitchPhaseConfirmInput, input_dict, wf, ctx)
        if isinstance(parsed, SubmitResult):
            return parsed

        # контекст
        try:
            c = SceneSwitchPhaseContext.model_validate(wf.context or {})
        except ValidationError as e:
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("context", str(e))],
            )

        # cancel
        if parsed.decision == "cancel":
            wf.status = "canceled"
            wf.stageKey = "completed"
            return ctx.rb.result(
                ok=True,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[],
            )

        # confirm: пересчитываем по текущей сцене
        pending_now = compute_pending(ctx.scene)
        snapshot_now = make_snapshot(ctx.scene)

        c.pending = pending_now
        c.snapshot = snapshot_now
        wf.context = c.model_dump(mode="json")

        if pending_now and not parsed.force:
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("input.force", "Есть незавершённые пункты. Укажи force=true чтобы переключить фазу.")],
            )

        # sessionPatch: обновляем сцену
        patch = {
            "scene": {
                "id": str(c.sceneId),
                "dataPatch": {
                    "mode": "combat",
                    "combat": {"phase": c.nextPhase},
                },
            }
        }

        wf.status = "completed"
        wf.stageKey = "completed"

        return ctx.rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
            sessionPatch=patch,
        )
