from __future__ import annotations
from typing import List
from uuid import UUID


from plugins.common.types import (
    ActionParticipants, ActionContext, SceneContext,
    ActionRole, Workflow, SubmitResult, ActionInfo, CharacterContext,
)
from plugins.common.protocols import ResultBuilder, StageCtx, issue


from ...codex import FullCodex
from .types import TerrifyContext
from .stages.terrify_setup import TerrifySetupStage
from .stages.terrify_roll import TerrifyRollStage
from .stages.terrify_result import TerrifyResultStage


from ...types import CharacterData


def _uniq(xs):
    out, seen = [], set()
    for x in xs:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out


class TerrifyWorkflow:
    key = "gumshoe.terrify"

    def __init__(self, full_codex: FullCodex):
        self.full_codex = full_codex
        self._stages = {
            TerrifySetupStage.key: TerrifySetupStage(self.full_codex),
            TerrifyRollStage.key: TerrifyRollStage(self.full_codex),
            TerrifyResultStage.key: TerrifyResultStage(self.full_codex),
        }
        self._rb = ResultBuilder(self._visible_ids, self._participants_fallback_ids)

    def actions_for(self, scene: SceneContext, role: ActionRole) -> List[ActionInfo]:
        if role != "gm":
            return []
        return [
            ActionInfo(
                key=self.key,
                title="Terrify",
                roles=["gm"],
                description="Проверка ужаса — персонажи бросают против урона по стабильности",
            )
        ]

    def _participants_fallback_ids(self, d):
        ids = []
        if gm := (d or {}).get("gmUserId"):
            ids.append(str(gm))
        for u in (d or {}).get("participants") or []:
            ids.append(str(u))
        return _uniq(ids)

    def _visible_ids(self, participants: ActionParticipants, wf: Workflow) -> List[str]:
        gm_id = str(participants.gmUserId)
        try:
            c = TerrifyContext.model_validate(wf.context or {})
        except Exception:
            return [gm_id]

        ids = [gm_id]
        stage = wf.stageKey

        if stage == TerrifySetupStage.key:
            return _uniq(ids)

        if stage in (TerrifyRollStage.key, TerrifyResultStage.key):
            for t in c.targets:
                if t.userId:
                    ids.append(str(t.userId))
            return _uniq(ids)

        if stage == "completed":
            return _uniq(ids)

        return _uniq(ids)

    def start(self, action_context: ActionContext) -> SubmitResult:
        if action_context.actorUserId != action_context.participants.gmUserId:
            return SubmitResult(
                ok=False,
                issues=[issue("", "Only GM can start terrify")],
                workflow=None,
                participantIds=[],
            )

        ctx = TerrifyContext(sceneId=action_context.scene.id)
        wf = Workflow(
            actionKey=self.key,
            stageKey=TerrifySetupStage.key,
            status="active",
            context=ctx.model_dump(mode="json"),
        )
        participants_dict = action_context.participants.model_dump(mode="json")
        participants = ActionParticipants.model_validate(participants_dict)

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
        prev_stage = wf.stageKey

        stage = self._stages.get(wf.stageKey)
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

        res = stage.submit(wf, ctx, action_context.input or {})
        if not (isinstance(res, SubmitResult) and res.ok):
            return res

        if prev_stage == TerrifyResultStage.key:
            return self._finish(action_context, wf)

        return res

    def _finish(self, action_context: ActionContext, wf: Workflow) -> SubmitResult:
        participants_dict = action_context.participants.model_dump(mode="json")
        participants = ActionParticipants.model_validate(participants_dict)

        try:
            c = TerrifyContext.model_validate(wf.context or {})
        except Exception as e:
            return self._rb.result(
                ok=False,
                wf=wf,
                participants=participants,
                participants_dict_fallback=participants_dict,
                issues=[issue("context", str(e))],
            )

        scene = action_context.scene
        codex = self.full_codex.skills
        stability_skill = codex.stability_skill()
        stability_key = stability_skill.id

        patch: dict[str, list[dict]] = {}

        characters = scene.characters or []
        chars_by_id: dict[UUID, CharacterContext] = {
            ch.id: ch for ch in characters if ch.id
        }

        for t in c.targets:
            char_id = t.characterId
            if not char_id:
                continue

            loss = int(t.stability_loss or 0)
            if loss < 0:
                continue

            ch = chars_by_id.get(char_id)
            if ch is None:
                continue

            data = CharacterData.model_validate(ch.data)
            current = int((data.skills or {}).get(stability_key, 0) or 0)
            data.skills[stability_key] = current - loss - t.spent_stability

            patch.setdefault("characters", []).append({
                "id": str(ch.id),
                "dataPatch": data.model_dump(mode="json"),
            })

        wf.status = "completed"
        wf.stageKey = "completed"

        return self._rb.result(
            ok=True,
            wf=wf,
            participants=participants,
            participants_dict_fallback=participants_dict,
            issues=[],
            sessionPatch=patch or None,
        )
