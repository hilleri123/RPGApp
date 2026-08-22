from __future__ import annotations

from typing import Any
from uuid import UUID

from plugins.common.types import ActionParticipants, ActionContext, SceneContext, ActionRole, Workflow, SubmitResult, StageEnvelope, ActionInfo
from plugins.common.protocols import ResultBuilder, StageCtx, issue

from .stages.roll_initiative import InitiativeRollOneStage
from .stages.initiative_result import InitiativeResultStage
from .types import InitiativeWorkflowContext, InitEntry, Roller


def _dump(m: Any) -> Any:
    return m.model_dump(mode="json") if hasattr(m, "model_dump") else m.dict()


class RollInitiativeWorkflow:
    key = "grudge.roll_initiative"

    def __init__(self):
        self._stages = {
            "initiative.roll_one": InitiativeRollOneStage(),
            "initiative.result": InitiativeResultStage(),
        }
        self._rb = ResultBuilder(self._visible_ids, self._participants_fallback_ids)

    def actions_for(self, scene: SceneContext, role: ActionRole) -> list[ActionInfo]:
        if scene.data.mode != "combat" or scene.data.combat is None:
            return []
        return [
            ActionInfo(
                key=self.key,
                title="Инициатива",
                roles=["gm"],
                description="Броски инициативы (NPC авто, игроки по очереди)",
            )
        ]

    def _participants_fallback_ids(self, participants_dict: dict[str, Any]) -> list[str]:
        ids: list[str] = []
        gm = (participants_dict or {}).get("gmUserId")
        if gm:
            ids.append(str(gm))
        for u in (participants_dict or {}).get("participants") or []:
            ids.append(str(u))

        out: list[str] = []
        seen: set[str] = set()
        for x in ids:
            if x in seen:
                continue
            seen.add(x)
            out.append(x)
        return out

    def _visible_ids(self, participants: ActionParticipants, wf: Workflow) -> list[str]:
        # audience = GM + rollers из контекста
        c = InitiativeWorkflowContext.model_validate(wf.context or {})
        ids = [str(participants.gmUserId)] + [str(r.userId) for r in (c.rollers or [])]

        out: list[str] = []
        seen: set[str] = set()
        for x in ids:
            if x in seen:
                continue
            seen.add(x)
            out.append(x)
        return out

    # ----------------
    # start
    # ----------------
    def start(self, action_context: ActionContext) -> SubmitResult:
        wf = Workflow(stageKey="initiative.roll_one", status="active")

        scene = action_context.scene
        data = scene.data

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

        entries: list[InitEntry] = []
        owners: list[UUID] = []

        for ch in (scene.characters or []):
            owner = action_context.links.characterToUserId.get(ch.id)

            entries.append(InitEntry(
                entityId=ch.id,
                kind="pc",
                name=getattr(ch, "name", "") or "",
                ownerUserId=owner,
                rolled=False,
                result=None,
            ))

            if owner:
                owners.append(owner)

        # uniq owners
        seen: set[UUID] = set()
        owners_uniq: list[UUID] = []
        for u in owners:
            if u in seen:
                continue
            seen.add(u)
            owners_uniq.append(u)

        rollers: list[Roller] = []
        for e in entries:
            if e.kind == "pc" and e.ownerUserId is not None:
                rollers.append(Roller(userId=e.ownerUserId, entityId=e.entityId, name=e.name))

        ctx = InitiativeWorkflowContext(sceneId=scene.id, order=entries, currentIndex=0, rollers=rollers)
        ctx.seek_next_unrolled()
        wf.context = ctx.model_dump(mode="json")

        # если некого кидать -> сразу стадия результата (пусть GM подтвердит/закроет)
        if ctx.is_done:
            wf.stageKey = "initiative.result"
            wf.status = "active"

        gm_id = action_context.participants.gmUserId
        participant_ids = [str(gm_id)] + [str(u) for u in owners_uniq]

        return SubmitResult(ok=True, issues=[], workflow=_dump(wf), participantIds=participant_ids)


    # ----------------
    # submit
    # ----------------
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
        prev_stage_key = wf.stageKey

        participants_dict = action_context.participants.model_dump(mode="json")
        participants = ActionParticipants.model_validate(participants_dict)

        if wf.status != "active":
            return self._rb.result(
                ok=False,
                wf=wf,
                participants=participants,
                participants_dict_fallback=participants_dict,
                issues=[issue("", "Workflow is not active")],
            )

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
        )

        res = stage.submit(wf, ctx, action_context.input or {})

        # если мы на initiative.result и submit ok=True от GM — применяем patch и закрываем
        if prev_stage_key == "initiative.result":
            if isinstance(res, SubmitResult) and res.ok:
                try:
                    c = InitiativeWorkflowContext.model_validate(wf.context or {})
                except Exception:
                    # если контекст сломан — просто вернём как есть
                    return res
                return self._finish(action_context, wf, c)

        return res

    # ----------------
    # finish helper
    # ----------------
    def _finish(self, action_context: ActionContext, wf: Workflow, ctx: InitiativeWorkflowContext) -> SubmitResult:
        def kind_prio(k: str) -> int:
            return 0 if k == "pc" else 1

        rolled = [e for e in ctx.order if e.result is not None]
        rolled.sort(key=lambda e: (-int(e.result or 0), kind_prio(e.kind), str(e.entityId)))

        initiative_ids = [str(e.entityId) for e in rolled]

        patch = {
            "scenes": [{
                "id": str(ctx.sceneId),
                "dataPatch": {
                    "mode": "combat",
                    "combat": {
                        "phase": "move",
                        "initiativeOrder": initiative_ids,
                        "activeIndex": 0,
                    }
                }
            }]
        }

        wf.status = "completed"
        wf.stageKey = "completed"

        participants_dict = action_context.participants.model_dump(mode="json")
        participants = ActionParticipants.model_validate(participants_dict)

        return self._rb.result(
            ok=True,
            wf=wf,
            participants=participants,
            participants_dict_fallback=participants_dict,
            issues=[],
            sessionPatch=patch,
        )
