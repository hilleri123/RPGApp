# plugins/gumshoe/investigate_obstacle/workflow.py
from __future__ import annotations
from plugins.common.types import (
    ActionParticipants, ActionContext, SceneContext,
    ActionRole, Workflow, SubmitResult, ActionInfo,
)
from plugins.common.protocols import ResultBuilder, StageCtx, issue, dump

from .stages.spend_loop import SpendLoopStage
from .stages.gm_confirm import GmConfirmStage
from .stages.finish import InvestigateResultStage
from .stages.assign_stage import AssignStage
from .types import InvestigateContext, InvestigateEntry

from ...types import CharacterData
from ...codex import FullCodex


def _uniq_str(xs):
    out, seen = [], set()
    for x in xs:
        if x not in seen:
            seen.add(x); out.append(x)
    return out


class InvestigateObstacleWorkflow:
    key = "gumshoe.investigate_obstacle"

    def __init__(self, full_codex: FullCodex):
        self.full_codex = full_codex
        self._stages = {
            AssignStage.key:              AssignStage(self.full_codex),
            SpendLoopStage.key:           SpendLoopStage(self.full_codex),
            GmConfirmStage.key:           GmConfirmStage(self.full_codex),
            InvestigateResultStage.key:   InvestigateResultStage(self.full_codex),
        }
        self._rb = ResultBuilder(self._visible_ids, self._participants_fallback_ids)

    def actions_for(self, scene: SceneContext, role: ActionRole) -> list[ActionInfo]:
        if not scene.obstacles:
            return []
        return [ActionInfo(
            key=self.key,
            title="Расследовать",
            roles=["gm"],
            description="Игрок преодолевает препятствие, тратя investigative очки",
        )]

    def _participants_fallback_ids(self, d):
        ids = []
        if gm := (d or {}).get("gmUserId"): ids.append(str(gm))
        for u in (d or {}).get("participants") or []: ids.append(str(u))
        return _uniq_str(ids)

    def _visible_ids(self, participants: ActionParticipants, wf: Workflow) -> list[str]:
        try:
            c = InvestigateContext.model_validate(wf.context or {})
            player_id = str(c.entry.playerUserId) if c.entry else None
        except Exception:
            player_id = None

        gm_id = str(participants.gmUserId)
        stage = wf.stageKey if wf else None

        if stage == AssignStage.key:
            # только ГМ видит назначение
            return [gm_id]

        if stage == SpendLoopStage.key:
            # игрок видит список + уже раскрытые тексты
            return _uniq_str([player_id] if player_id else [])

        if stage == GmConfirmStage.key:
            # только GM подтверждает
            return _uniq_str([gm_id])

        if stage == InvestigateResultStage.key:
            # GM закрывает
            return _uniq_str([gm_id])

        if stage == "completed":
            return _uniq_str([gm_id] + ([player_id] if player_id else []))

        return _uniq_str([gm_id] + ([player_id] if player_id else []))

    def start(self, action_context: ActionContext) -> SubmitResult:
        scene = action_context.scene

        if not scene.obstacles:
            return SubmitResult(ok=False, issues=[issue("scene", "No obstacles available")],
                                workflow=None, participantIds=[])

        gm_id = action_context.participants.gmUserId
        actor_id = action_context.actorUserId

        # safety: только ГМ может стартовать
        if gm_id != actor_id:
            return SubmitResult(
                ok=False,
                issues=[issue("actor", "Only GM can start investigation")],
                workflow=None,
                participantIds=[],
            )
        
        entry = InvestigateEntry(
            playerUserId=None,   # пока не выбран
            characterId=None,
            obstacle_id=None,
        )
        ctx = InvestigateContext(sceneId=scene.id, entry=entry)
        wf = Workflow(
            actionKey=self.key,
            stageKey=AssignStage.key,
            tags=["hidden"],
            status="active",
            context=ctx.model_dump(mode="json"),
        )

        participants_dict = action_context.participants.model_dump(mode="json")
        participants = ActionParticipants.model_validate(participants_dict)

        return self._rb.result(ok=True, wf=wf, participants=participants,
                               participants_dict_fallback=participants_dict, issues=[])

    def submit(self, action_context: ActionContext) -> SubmitResult:
        wf = action_context.workflow
        if wf is None:
            return self._rb.result(ok=False, wf=None, participants=None,
                                   participants_dict_fallback=action_context.participants.model_dump(mode="json"),
                                   issues=[issue("workflow", "Missing")])

        participants_dict = action_context.participants.model_dump(mode="json")
        participants = ActionParticipants.model_validate(participants_dict)
        prev_stage = wf.stageKey

        stage = self._stages.get(wf.stageKey)
        if not stage:
            return self._rb.result(ok=False, wf=wf, participants=participants,
                                   participants_dict_fallback=participants_dict,
                                   issues=[issue("", "Unknown stage")])

        ctx = StageCtx(
            scene=action_context.scene,
            actor_user_id=action_context.actorUserId,
            participants=participants,
            participants_dict=participants_dict,
            rb=self._rb,
            links=action_context.links,
        )

        res = stage.submit(wf, ctx, action_context.input or {})
        if not (isinstance(res, SubmitResult) and res.ok):
            return res

        # ФИНИШ: GM закрыл result-стадию
        if prev_stage == InvestigateResultStage.key:
            return res  # sessionPatch уже внутри

        return res
