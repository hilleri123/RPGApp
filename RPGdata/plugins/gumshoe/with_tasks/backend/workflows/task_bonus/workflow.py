# plugins/gumshoe/task_bonus/workflow.py
from __future__ import annotations

from plugins.common.types import (
    ActionParticipants, ActionContext, SceneContext,
    ActionRole, Workflow, SubmitResult, ActionInfo,
)
from plugins.common.protocols import ResultBuilder, StageCtx, issue

from .stages.request import TaskBonusRequestStage
from .stages.gm_confirm import TaskBonusGmConfirmStage
from .types import TaskBonusContext, TaskBonusEntry

def _uniq_str(xs):
    out, seen = [], set()
    for x in xs:
        if x not in seen:
            seen.add(x); out.append(x)
    return out

class TaskBonusWorkflow:
    key = 'gumshoe.task_bonus'

    def __init__(self, full_codex):
        self._stages = {
            'gumshoe.task_bonus.request':    TaskBonusRequestStage(full_codex),
            'gumshoe.task_bonus.gm_confirm': TaskBonusGmConfirmStage(full_codex),
        }
        self._rb = ResultBuilder(self._visible_ids, self._participants_fallback_ids)

    # ------------------------------------------------------------------ #
    # visibility
    
    def actions_for(self, scene: SceneContext, role: ActionRole) -> list[ActionInfo]:
        return [ActionInfo(
            key=self.key,
            title="Выполнить задание",
            roles=["player"],
            description="Игрок считает, что он выполнил задание",
        )]

    def _participants_fallback_ids(self, d: dict) -> list[str]:
        ids = []
        if gm := (d or {}).get('gmUserId'):
            ids.append(str(gm))
        for u in (d or {}).get('participants') or []:
            ids.append(str(u))
        return _uniq_str(ids)

    def _visible_ids(self, participants: ActionParticipants, wf: Workflow) -> list[str]:
        gm_id = str(participants.gmUserId)

        try:
            c = TaskBonusContext.model_validate(wf.context or {})
            player_id = str(c.entry.playerUserId) if c.entry and c.entry.playerUserId else None
        except Exception:
            player_id = None

        stage = wf.stageKey if wf else None

        if stage == 'gumshoe.task_bonus.request':
            # только игрок, инициировавший запрос
            return _uniq_str([player_id] if player_id else [gm_id])

        if stage == 'gumshoe.task_bonus.gm_confirm':
            # GM подтверждает, игрок ждёт
            return _uniq_str([gm_id] + ([player_id] if player_id else []))

        if stage == 'completed':
            return _uniq_str([gm_id] + ([player_id] if player_id else []))

        return _uniq_str([gm_id] + ([player_id] if player_id else []))

    # ------------------------------------------------------------------ #
    # start

    def start(self, action_context: ActionContext) -> SubmitResult:
        participants_dict = action_context.participants.model_dump(mode='json')
        participants = ActionParticipants.model_validate(participants_dict)

        # стартовать может только игрок (не GM)
        scene    = action_context.scene

        actor_id = action_context.actorUserId
        gm_id    = action_context.participants.gmUserId


        if actor_id == gm_id:
            return self._rb.result(
                ok=False,
                wf=None,
                participants=participants,
                participants_dict_fallback=participants_dict,
                issues=[issue('actor', 'Only players can request a task bonus')],
            )
        
        links    = action_context.links
        char = next(
            (ch for ch in (scene.characters or [])
            if links.characterToUserId.get(ch.id) == actor_id),
            None,
        )
        if char is None:
            return self._rb.result(
                ok=False,
                wf=None,
                participants=participants,
                participants_dict_fallback=participants_dict,
                issues=[issue('scene', 'Actor has no character in this scene')],
            )
        entry = TaskBonusEntry(
            playerUserId=actor_id,
            characterId=char.id,
        )
        ctx   = TaskBonusContext(entry=entry)


        wf = Workflow(
            actionKey=self.key,
            stageKey='gumshoe.task_bonus.request',
            tags=["hidden"],
            status='active',
            context=ctx.model_dump(mode='json'),
        )

        return self._rb.result(
            ok=True,
            wf=wf,
            participants=participants,
            participants_dict_fallback=participants_dict,
            issues=[],
        )

    # ------------------------------------------------------------------ #
    # submit

    def submit(self, action_context: ActionContext) -> SubmitResult:
        wf = action_context.workflow
        participants_dict = action_context.participants.model_dump(mode='json')
        participants = ActionParticipants.model_validate(participants_dict)

        if wf is None:
            return self._rb.result(
                ok=False, wf=None,
                participants=participants,
                participants_dict_fallback=participants_dict,
                issues=[issue('workflow', 'Missing')],
            )

        stage = self._stages.get(wf.stageKey)
        if not stage:
            return self._rb.result(
                ok=False, wf=wf,
                participants=participants,
                participants_dict_fallback=participants_dict,
                issues=[issue('', f'Unknown stage: {wf.stageKey}')],
            )
        
        if (action_context.input or {}).get('action') == 'close':
            wf = action_context.workflow
            participants_dict = action_context.participants.model_dump(mode='json')
            participants = ActionParticipants.model_validate(participants_dict)
            wf.stageKey = 'completed'
            wf.status   = 'completed'
            return self._rb.result(
                ok=True, wf=wf,
                participants=participants,
                participants_dict_fallback=participants_dict,
                issues=[],
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