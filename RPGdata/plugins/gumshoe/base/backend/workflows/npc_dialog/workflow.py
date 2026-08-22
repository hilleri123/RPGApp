# plugins/gumshoe/npc_dialog/workflow.py
from __future__ import annotations
from uuid import UUID
from plugins.common.types import (
    ActionParticipants, ActionContext, ActionRole,
    Workflow, SubmitResult, ActionInfo,
)
from plugins.common.protocols import ResultBuilder, StageCtx, issue
from .stages.select_participants import SelectParticipantsStage
from .stages.dialog_loop import DialogLoopStage
from .stages.gm_confirm_spend import GmConfirmSpendStage
from .stages.finish import DialogResultStage
from .types import DialogContext, DialogEntry
from ...codex import FullCodex


def _uniq(xs):
    out, seen = [], set()
    for x in xs:
        if x not in seen:
            seen.add(x); out.append(x)
    return out


class NpcDialogWorkflow:
    key = "gumshoe.npc_dialog"

    def __init__(self, full_codex: FullCodex):
        self.full_codex = full_codex
        self._stages = {
            SelectParticipantsStage.key: SelectParticipantsStage(full_codex),
            DialogLoopStage.key:         DialogLoopStage(full_codex),
            GmConfirmSpendStage.key:     GmConfirmSpendStage(full_codex),
            DialogResultStage.key:       DialogResultStage(full_codex),
        }
        self._rb = ResultBuilder(self._visible_ids, self._participants_fallback_ids)

    def actions_for(self, scene, role: ActionRole) -> list[ActionInfo]:
        return [ActionInfo(
            key=self.key,
            title="Разговор с НПС",
            roles=["gm"],
            description="Разговор с НПС, трата навыков на получение информации",
        )]

    def _participants_fallback_ids(self, d):
        ids = []
        if gm := (d or {}).get("gmUserId"): ids.append(str(gm))
        for u in (d or {}).get("participants") or []: ids.append(str(u))
        return _uniq(ids)

    def _visible_ids(self, participants: ActionParticipants, wf: Workflow) -> list[str]:
        gm_id = str(participants.gmUserId)
        stage = wf.stageKey if wf else None

        try:
            c = DialogContext.model_validate(wf.context or {})
            player_ids: list[str] = list(c.entry.player_user_ids) if c.entry else []
        except Exception:
            player_ids = []

        if stage == SelectParticipantsStage.key:
            return [gm_id]

        if stage == DialogLoopStage.key:
            # ГМ управляет + игроки видят происходящее
            return _uniq([gm_id] + player_ids)

        if stage == GmConfirmSpendStage.key:
            # Только игроки подтверждают трату — ГМ не видит
            return _uniq(player_ids)

        if stage == DialogResultStage.key:
            return _uniq([gm_id] + player_ids)

        if stage == "completed":
            return _uniq([gm_id] + player_ids)

        return _uniq([gm_id] + player_ids)



    def start(self, action_context: ActionContext) -> SubmitResult:
        gm_id = action_context.participants.gmUserId
        if gm_id != action_context.actorUserId:
            return SubmitResult(ok=False, issues=[issue("actor", "Only GM")],
                                workflow=None, participantIds=[])

        ctx = DialogContext(
            sceneId=action_context.scene.id,
            skills=self.full_codex.skills.as_config(),  # ← сюда
        )

        wf = Workflow(
            actionKey=self.key,
            stageKey=SelectParticipantsStage.key,
            tags=[],
            status="active",
            context=ctx.model_dump(mode="json"),
        )
        pd = action_context.participants.model_dump(mode="json")
        return self._rb.result(ok=True, wf=wf,
                            participants=ActionParticipants.model_validate(pd),
                            participants_dict_fallback=pd, issues=[])


    def submit(self, action_context: ActionContext) -> SubmitResult:
        wf = action_context.workflow
        pd = action_context.participants.model_dump(mode="json")
        participants = ActionParticipants.model_validate(pd)

        if wf is None:
            return self._rb.result(ok=False, wf=None, participants=participants,
                                   participants_dict_fallback=pd,
                                   issues=[issue("workflow", "Missing")])

        stage = self._stages.get(wf.stageKey)
        if not stage:
            return self._rb.result(ok=False, wf=wf, participants=participants,
                                   participants_dict_fallback=pd,
                                   issues=[issue("", "Unknown stage")])

        ctx_obj = StageCtx(
            scene=action_context.scene,
            actor_user_id=action_context.actorUserId,
            participants=participants,
            participants_dict=pd,
            rb=self._rb,
            links=action_context.links,
        )
        return stage.submit(wf, ctx_obj, action_context.input or {})