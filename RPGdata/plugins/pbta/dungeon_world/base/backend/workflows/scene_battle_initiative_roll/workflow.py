from __future__ import annotations

from typing import Any

from plugins.common.protocols import ResultBuilder, StageCtx, dump, issue
from plugins.common.types import (
    ActionContext,
    ActionInfo,
    ActionParticipants,
    ActionRole,
    SceneContext,
    SubmitResult,
    Workflow,
)

from ...initiative import NO_INITIATIVE_MESSAGE, initiative_allowed, scene_patch
from .logic import (
    apply_edit,
    build_pending,
    candidates,
    owners_map,
    scene_participants,
    to_initiative_state,
)
from .stages.review import InitiativeReviewStage
from .stages.roll import InitiativeRollStage
from .types import InitiativeContext

ROLL = InitiativeRollStage.key
REVIEW = InitiativeReviewStage.key


def _uniq(xs: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for x in xs:
        if x and x not in seen:
            seen.add(x)
            out.append(x)
    return out


class RollInitiativeWorkflow:
    """Инициатива DW: 2d6 + ЛОВ для каждого участника сцены.

    1. Стадия бросков: игроки сами бросают за своих персонажей, мастер — за всех NPC
       (и персонажей без игрока) от одного seed. Бросает сервер, значения честные.
    2. Стадия мастера: можно выровнять очередность — поменять порядок, добавить
       новых участников, перебросить или задать итог руками.
    После подтверждения порядок записывается в `scene.data.initiative`.
    """

    key = "roll_initiative"

    def __init__(self, full_codex: Any = None):
        self.full_codex = full_codex
        self._stages = {ROLL: InitiativeRollStage(), REVIEW: InitiativeReviewStage()}
        self._rb = ResultBuilder(self._visible_ids, self._participants_fallback_ids)

    # ------------------------------------------------------------------ list

    def actions_for(self, scene: SceneContext, role: ActionRole) -> list[ActionInfo]:
        if role != "gm":
            return []
        if not initiative_allowed(scene.data):
            return []
        if not (scene.characters or scene.npcs):
            return []
        return [
            ActionInfo(
                key=self.key,
                title="Инициатива",
                roles=["gm"],
                description="Игроки бросают за персонажей, мастер — за NPC; затем мастер выравнивает порядок",
            )
        ]

    # ------------------------------------------------------------ visibility

    def _participants_fallback_ids(self, d: dict[str, Any] | None) -> list[str]:
        ids: list[str] = []
        if gm := (d or {}).get("gmUserId"):
            ids.append(str(gm))
        for u in (d or {}).get("participants") or []:
            ids.append(str(u))
        return _uniq(ids)

    def _visible_ids(self, participants: ActionParticipants, wf: Workflow) -> list[str]:
        if wf is None or wf.status != "active":
            return []  # итог виден всем
        gm = str(participants.gmUserId)
        if wf.stageKey == ROLL:
            # Бросают мастер и игроки, чьи персонажи в сцене.
            owners = [
                str(e.get("owner_user_id"))
                for e in (wf.context or {}).get("entries") or []
                if isinstance(e, dict) and e.get("owner_user_id")
            ]
            return _uniq([gm, *owners])
        if wf.stageKey == REVIEW:
            return [gm]  # пока мастер выравнивает порядок — видит только он
        return []

    # ----------------------------------------------------------------- start

    def start(self, action_context: ActionContext) -> SubmitResult:
        participants_dict = action_context.participants.model_dump(mode="json")
        participants = ActionParticipants.model_validate(participants_dict)

        if action_context.actorUserId != action_context.participants.gmUserId:
            return self._fail(None, participants, participants_dict, "Инициативу бросает только мастер")
        if not initiative_allowed(action_context.scene.data):
            return self._fail(None, participants, participants_dict, NO_INITIATIVE_MESSAGE)

        scene = action_context.scene
        owners = owners_map(action_context.links)
        ctx = build_pending(scene, owners)
        if not ctx.entries:
            return self._fail(None, participants, participants_dict, "В сцене нет персонажей и NPC")

        wf = Workflow(actionKey=self.key, stageKey=ROLL, status="active")
        self._store(wf, ctx, scene_participants(scene, owners))
        return self._rb.result(
            ok=True,
            wf=wf,
            participants=participants,
            participants_dict_fallback=participants_dict,
            issues=[],
        )

    # ---------------------------------------------------------------- submit

    def submit(self, action_context: ActionContext) -> SubmitResult:
        wf, participants, participants_dict = self._unpack(action_context)
        if wf is None:
            return self._fail(None, participants, participants_dict, "Workflow is missing")

        stage = self._stages.get(wf.stageKey)
        if wf.status != "active" or stage is None:
            return self._fail(wf, participants, participants_dict, "Workflow is not active")

        stage_ctx = self._stage_ctx(action_context, participants, participants_dict)
        was_stage = wf.stageKey
        res = stage.submit(wf, stage_ctx, action_context.input or {})
        if not res.ok:
            return res

        if was_stage == ROLL:
            # Броски идут, пока не бросили все; тогда стадия сама перешла к проверке.
            if wf.stageKey == REVIEW:
                ctx = InitiativeContext.model_validate(wf.context or {})
                self._store(wf, ctx, scene_participants(action_context.scene, owners_map(action_context.links)))
            return self._rb.result(
                ok=True,
                wf=wf,
                participants=participants,
                participants_dict_fallback=participants_dict,
                issues=[],
            )

        try:
            ctx = InitiativeContext.model_validate(wf.context or {})
        except Exception:
            return self._fail(wf, participants, participants_dict, "Контекст инициативы повреждён")

        wf.status = "completed"
        wf.stageKey = "completed"
        return self._rb.result(
            ok=True,
            wf=wf,
            participants=participants,
            participants_dict_fallback=participants_dict,
            issues=[],
            sessionPatch=scene_patch(ctx.scene_id, to_initiative_state(ctx)),
            logEvents=[
                self._rb.log_text(
                    "Инициатива: " + " → ".join(e.name or e.entity_id for e in ctx.entries),
                    action_key=self.key,
                    tags=["initiative"],
                )
            ],
        )

    # ----------------------------------------------------------------- patch

    def patch(self, action_context: ActionContext) -> SubmitResult:
        wf, participants, participants_dict = self._unpack(action_context)
        if wf is None:
            return self._fail(None, participants, participants_dict, "Workflow is missing")
        if wf.status != "active":
            return self._fail(wf, participants, participants_dict, "Workflow is not active")
        if wf.stageKey != REVIEW:
            return self._fail(wf, participants, participants_dict, "Порядок можно править после бросков")
        if action_context.actorUserId != action_context.participants.gmUserId:
            return self._fail(wf, participants, participants_dict, "Порядок правит только мастер")

        try:
            ctx = InitiativeContext.model_validate(wf.context or {})
        except Exception:
            return self._fail(wf, participants, participants_dict, "Контекст инициативы повреждён")

        scene_people = scene_participants(action_context.scene, owners_map(action_context.links))
        error = apply_edit(ctx, scene_people, action_context.input or {})
        if error:
            return self._fail(wf, participants, participants_dict, error)

        self._store(wf, ctx, scene_people)
        return self._rb.result(
            ok=True,
            wf=wf,
            participants=participants,
            participants_dict_fallback=participants_dict,
            issues=[],
        )

    # --------------------------------------------------------------- helpers

    def _store(self, wf: Workflow, ctx: InitiativeContext, scene_people: dict[str, dict[str, Any]]) -> None:
        wf.context = ctx.model_dump(mode="json")
        wf.stageData = {"candidates": candidates(ctx, scene_people)}

    def _unpack(self, action_context: ActionContext):
        participants_dict = action_context.participants.model_dump(mode="json")
        participants = ActionParticipants.model_validate(participants_dict)
        return action_context.workflow, participants, participants_dict

    def _stage_ctx(self, action_context: ActionContext, participants, participants_dict) -> StageCtx:
        return StageCtx(
            scene=action_context.scene,
            actor_user_id=action_context.actorUserId,
            participants=participants,
            participants_dict=participants_dict,
            rb=self._rb,
            links=action_context.links,
        )

    def _fail(self, wf, participants, participants_dict, message: str) -> SubmitResult:
        return self._rb.result(
            ok=False,
            wf=wf,
            participants=participants if wf is not None else None,
            participants_dict_fallback=participants_dict,
            issues=[issue("", message)],
        )
