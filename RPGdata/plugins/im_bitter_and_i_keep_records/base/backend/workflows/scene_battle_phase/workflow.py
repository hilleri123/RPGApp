from __future__ import annotations

from typing import Any
from pydantic import ValidationError

from plugins.common.types import ActionParticipants, ActionRole, Workflow, ActionContext, SceneContext, SubmitResult, ActionInfo
from plugins.common.protocols import ResultBuilder, StageCtx, issue

from .stages import SwitchPhaseConfirmStage
from .types_scene_switch_phase import SceneSwitchPhaseContext
from .utils_scene_switch_phase import get_next_phase, make_snapshot, compute_pending


def _dump(m: Any) -> Any:
    return m.model_dump(mode="json") if hasattr(m, "model_dump") else m.dict()


class SwitchCombatPhaseWorkflow:
    key = "grudge.switch_combat_phase"

    def __init__(self):
        self._stages = {
            "switch_phase.confirm": SwitchPhaseConfirmStage(),
        }
        self._rb = ResultBuilder(self._visible_ids, self._participants_fallback_ids)

    # --- available actions ---

    def actions_for(self, scene: SceneContext, role: ActionRole) -> list[ActionInfo]:
        if scene.data.mode != "combat" or scene.data.combat is None:
            return []

        return [
            ActionInfo(
                key=self.key,
                title="Фаза",
                roles=["gm"],
                description="Следующая фаза боя",
            )
        ]

    # --- visibility helpers ---

    def _participants_fallback_ids(self, participants_dict: dict[str, Any]) -> list[str]:
        # Оставляю как было: ResultBuilder у тебя так устроен.
        out: list[str] = []
        gm = (participants_dict or {}).get("gmUserId")
        if gm:
            out.append(str(gm))
        return out

    def _visible_ids(self, participants: ActionParticipants, wf: Workflow) -> list[str]:
        return [str(participants.gmUserId)]

    # --- start ---

    def start(self, action_context: ActionContext) -> SubmitResult:
        wf = Workflow(stageKey="switch_phase.confirm", status="active")

        scene = action_context.scene
        data = scene.data

        # CHECK: combat enabled
        if data.mode != "combat" or data.combat is None:
            return SubmitResult(
                ok=False,
                issues=[{
                    "path": "scene.data.mode",
                    "message": "Combat is not enabled for this scene",
                    "meta": {"mode": data.mode},
                }],
                workflow=_dump(wf),
                participantIds=[],
            )

        # combat state гарантированно есть
        cur_state = data.combat.phase
        nxt_phase = get_next_phase(cur_state)

        ctx_model = SceneSwitchPhaseContext(
            sceneId=scene.id,
            currentPhase=cur_state,        # строка "move/melee/..."
            nextPhase=nxt_phase,                 # строка
            pending=compute_pending(scene),
            snapshot=make_snapshot(scene),
            sceneData=data,                      # <-- ЛУЧШЕ: пусть это поле в модели SceneSwitchPhaseContext будет SceneData
        )
        wf.context = ctx_model.model_dump(mode="json")  # если Workflow.context у тебя dict; если модель — присвой модель

        gm_id = action_context.participants.gmUserId
        return SubmitResult(
            ok=True,
            issues=[],
            workflow=_dump(wf),
            participantIds=[str(gm_id)],
        )



    # --- submit ---

    def submit(self, action_context: ActionContext) -> SubmitResult:
        wf = action_context.workflow
        if wf is None:
            return self._rb.result(
                ok=False,
                wf=None,
                participants=None,
                participants_dict_fallback=action_context.participants.model_dump(mode="json"),
                issues=[issue("workflow", "Workflow is missing")],
            )

        try:
            participants = ActionParticipants.model_validate(
                action_context.participants.model_dump(mode="json")
            )
        except ValidationError as e:
            return self._rb.result(
                ok=False,
                wf=wf,
                participants=None,
                participants_dict_fallback=action_context.participants.model_dump(mode="json"),
                issues=[issue("participants", str(e))],
            )

        if wf.status != "active":
            return self._rb.result(
                ok=False,
                wf=wf,
                participants=participants,
                participants_dict_fallback=action_context.participants.model_dump(mode="json"),
                issues=[issue("", "Workflow is not active")],
            )

        stage = self._stages.get(wf.stageKey)
        if not stage:
            return self._rb.result(
                ok=False,
                wf=wf,
                participants=participants,
                participants_dict_fallback=action_context.participants.model_dump(mode="json"),
                issues=[issue("", "Unknown stage")],
            )

        input_dict = action_context.input or {}

        ctx = StageCtx(
            scene=action_context.scene,
            actor_user_id=action_context.actorUserId,  # UUID
            participants=participants,
            participants_dict=action_context.participants.model_dump(mode="json"),
            rb=self._rb,
        )
        return stage.submit(wf, ctx, input_dict)
