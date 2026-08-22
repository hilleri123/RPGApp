# plugins/everyone_is_john/perform_action/workflow.py
from __future__ import annotations
from typing import Any
from uuid import UUID

from plugins.common.types import (
    ActionParticipants, ActionContext, SceneContext,
    ActionRole, Workflow, SubmitResult, ActionInfo,
)
from plugins.common.protocols import ResultBuilder, StageCtx, issue, dump

from .stages.action_declare import ActionDeclareStage
from .stages.action_gm_review import ActionGmReviewStage
from .stages.action_canvas import ActionCanvasStage
from .stages.action_result import ActionResultStage
from .types import PerformActionContext, PerformActionEntry
from ...types import SceneData, CharacterData


def _uniq_str(xs):
    out, seen = [], set()
    for x in xs:
        if x not in seen:
            seen.add(x); out.append(x)
    return out


class PerformActionWorkflow:
    key = "everyone_is_john.perform_action"

    def __init__(self):
        self._stages = {
            ActionDeclareStage.key:   ActionDeclareStage(),
            ActionGmReviewStage.key:  ActionGmReviewStage(),
            ActionCanvasStage.key:    ActionCanvasStage(),
            ActionResultStage.key:    ActionResultStage(),
        }
        self._rb = ResultBuilder(self._visible_ids, self._participants_fallback_ids)

    def actions_for(self, scene: SceneContext, role: ActionRole) -> list[ActionInfo]:
        scene_data = SceneData.model_validate(scene.data)
        # действие доступно только когда у сцены есть character_id (активный Джон)
        if scene_data.character_id is None or role != "gm":
            return []
        # показываем игроку (у которого этот персонаж) и GM
        return [ActionInfo(
            key=self.key,
            title="Заявить действие",
            roles=["player", "gm"],
            description="Игрок описывает действие, тратит жетоны и рисует seed",
        )]

    def _participants_fallback_ids(self, d):
        ids = []
        if gm := (d or {}).get("gmUserId"): ids.append(str(gm))
        for u in (d or {}).get("participants") or []: ids.append(str(u))
        return _uniq_str(ids)

    def _visible_ids(self, participants: ActionParticipants, wf: Workflow) -> list[str]:
        try:
            c = PerformActionContext.model_validate(wf.context or {})
            player_id = str(c.entry.playerUserId) if c.entry else None
        except Exception:
            player_id = None

        gm_id = str(participants.gmUserId)
        stage = wf.stageKey if wf else None

        # кто активен на каждой стадии
        if stage == "john.action.declare":
            # только игрок заполняет заявку
            return _uniq_str([player_id] if player_id else [])

        if stage == "john.action.gm_review":
            # только мастер рассматривает
            return _uniq_str([gm_id])

        if stage == "john.action.canvas":
            # только игрок рисует
            return _uniq_str([player_id] if player_id else [])

        if stage == "john.action.result":
            # мастер подтверждает финал
            return _uniq_str([gm_id] + [player_id] if player_id else [])

        if stage == "completed":
            # показываем обоим итог
            return _uniq_str([gm_id] + ([player_id] if player_id else []))

        # fallback
        return _uniq_str([gm_id] + ([player_id] if player_id else []))


    def start(self, action_context: ActionContext) -> SubmitResult:
        scene = action_context.scene
        scene_data = SceneData.model_validate(scene.data)

        if scene_data.character_id is None:
            return SubmitResult(ok=False, issues=[issue("scene", "No active character")],
                                workflow=None, participantIds=[])

        char_id: UUID = scene_data.character_id
        owner = action_context.links.characterToUserId.get(char_id)
        if owner is None:
            return SubmitResult(ok=False, issues=[issue("scene", "Character has no owner")],
                                workflow=None, participantIds=[])

        char = next((c for c in (scene.characters or []) if c.id == char_id), None)
        char_data = CharacterData.model_validate(char.data) if char else CharacterData()

        entry = PerformActionEntry(
            playerUserId=owner,
            characterId=char_id,
            characterName=getattr(char, "name", "") or "",
            profession=getattr(char_data, "profession", "") or "",
            available_tokens=char_data.tokens,
        )

        ctx = PerformActionContext(sceneId=scene.id, entry=entry)
        wf = Workflow(
            actionKey=self.key,
            stageKey=ActionDeclareStage.key,
            status="active",
            context=ctx.model_dump(mode="json"),
        )

        participants_dict = action_context.participants.model_dump(mode="json")
        participants = ActionParticipants.model_validate(participants_dict)

        # _rb.result сам вызовет _visible_ids(participants, wf)
        # и вернёт только player_id для стадии john.action.declare
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

        # ФИНИШ: GM подтвердил result
        if prev_stage == ActionResultStage.key:
            return self._finish(action_context, wf)

        return res

    def _finish(self, action_context: ActionContext, wf: Workflow) -> SubmitResult:
        participants_dict = action_context.participants.model_dump(mode="json")
        participants = ActionParticipants.model_validate(participants_dict)

        try:
            c = PerformActionContext.model_validate(wf.context or {})
        except Exception as e:
            return self._rb.result(ok=False, wf=wf, participants=participants,
                                   participants_dict_fallback=participants_dict,
                                   issues=[issue("context", str(e))])

        entry = c.entry
        wf.status = "completed"
        wf.stageKey = "completed"

        patch: dict = {}

        if not entry.success:
            # провал — убираем character_id из сцены
            patch["scenes"] = [{
                "id": str(c.sceneId),
                "dataPatch": SceneData(character_id=None, buff=0).model_dump(mode="json"),
            }]
        else:
            # успех — списываем жетоны
            spent = max(0, entry.spend_tokens or 0)
            new_tokens = max(0, (getattr(entry, "available_tokens", 0) or 0) - spent)
            patch["characters"] = [{
                "id": str(entry.characterId),
                "dataPatch": {"tokens": new_tokens},
            }]

        return self._rb.result(ok=True, wf=wf, participants=participants,
                               participants_dict_fallback=participants_dict,
                               issues=[], sessionPatch=patch)
