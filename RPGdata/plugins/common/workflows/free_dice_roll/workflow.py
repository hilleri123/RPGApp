from __future__ import annotations

from typing import Any, List

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

from .stages import FreeDiceDeclareStage, FreeDiceResultStage, FreeDiceRollStage
from .types import FreeDiceContext


def _uniq(xs: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for x in xs:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out


class FreeDiceRollWorkflow:
    key = "common.free_dice_roll"

    def __init__(self, full_codex: Any) -> None:
        self.full_codex = full_codex
        self._stages = {
            FreeDiceDeclareStage.key: FreeDiceDeclareStage(full_codex),
            FreeDiceRollStage.key: FreeDiceRollStage(full_codex),
            FreeDiceResultStage.key: FreeDiceResultStage(full_codex),
        }
        self._rb = ResultBuilder(self._visible_ids, self._participants_fallback_ids)

    def actions_for(self, scene: SceneContext, role: ActionRole) -> List[ActionInfo]:
        if role not in ("player", "gm"):
            return []
        return [
            ActionInfo(
                key=self.key,
                title="Свободный бросок",
                roles=["player", "gm"],
                description="Бросок произвольных кубов с описанием заявки и seed-рисунком",
            ),
        ]

    def _participants_fallback_ids(self, d: dict[str, Any] | None) -> list[str]:
        ids: list[str] = []
        if gm := (d or {}).get("gmUserId"):
            ids.append(str(gm))
        for u in (d or {}).get("participants") or []:
            ids.append(str(u))
        return _uniq(ids)

    def _visible_ids(self, participants: ActionParticipants, wf: Workflow | None) -> List[str]:
        # Result: empty list => visible to everyone (session policy).
        if wf and wf.stageKey == FreeDiceResultStage.key:
            return []

        # Declare + seed/roll: initiator only (GM sees them only if they started the roll).
        actor_id: str | None = None
        if wf:
            try:
                fc = FreeDiceContext.model_validate(wf.context or {})
                if fc.actor_user_id:
                    actor_id = str(fc.actor_user_id)
            except Exception:
                pass
        if not actor_id and participants.initiatorUserId:
            actor_id = str(participants.initiatorUserId)
        return _uniq([actor_id] if actor_id else [])

    def start(self, action_context: ActionContext) -> SubmitResult:
        participants_dict = action_context.participants.model_dump(mode="json")
        participants = ActionParticipants.model_validate(participants_dict)

        wf = Workflow(
            actionKey=self.key,
            stageKey=FreeDiceDeclareStage.key,
            status="active",
            context=FreeDiceContext(
                scene_id=str(action_context.scene.id),
                actor_user_id=str(action_context.actorUserId),
                declaration="",
                expression="1d6",
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

        stage = self._stages.get(wf.stageKey or "")
        if not stage:
            return self._rb.result(
                ok=False,
                wf=wf,
                participants=participants,
                participants_dict_fallback=participants_dict,
                issues=[issue("", "Unknown stage")],
            )

        ctx = StageCtx(
            scene=action_context.scene,
            actor_user_id=action_context.actorUserId,
            participants=participants,
            participants_dict=participants_dict,
            rb=self._rb,
            links=action_context.links,
        )
        return stage.submit(wf, ctx, action_context.input or {})

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

        stage = self._stages.get(wf.stageKey or "")
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
            result = ctx.rb.result(
                ok=False,
                wf=wf,
                participants=participants,
                participants_dict_fallback=participants_dict,
                issues=[issue("", "Patch not supported on this stage")],
            )

        if result.ok and result.workflow is not None:
            result.workflow.stageKey = prev_stage
        return result
