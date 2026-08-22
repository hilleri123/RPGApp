from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

from plugins.common.types import (
    ActionParticipants,
    ActionContext,
    SceneContext,
    ActionRole,
    Workflow,
    SubmitResult,
    ActionInfo,
)
from plugins.common.protocols import ResultBuilder, StageCtx, issue, dump

from .stages.initiative_bet import InitiativeBetStage
from .stages.initiative_tie_roll import InitiativeTieRollStage
from .stages.initiative_result import InitiativeResultStage
from .stages.initiative_tie_canvas import InitiativeTieCanvasStage

from .types import InitiativeWorkflowContext, InitEntry, Roller
from ...types import SceneData, CharacterData


def _uniq_str(xs: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for x in xs:
        if x in seen:
            continue
        seen.add(x)
        out.append(x)
    return out


def _spent(e: InitEntry) -> int:
    return int(e.spend_tokens or 0)


def _tie(e: InitEntry) -> int:
    return int(e.tieResult or 0)


class RollInitiativeWorkflow:
    key = "grudge.roll_initiative"

    def __init__(self):
        self._stages = {
            InitiativeBetStage.key: InitiativeBetStage(),
            InitiativeTieCanvasStage.key: InitiativeTieCanvasStage(),   # ← новое
            InitiativeTieRollStage.key: InitiativeTieRollStage(),
            InitiativeResultStage.key: InitiativeResultStage(),
        }
        self._rb = ResultBuilder(self._visible_ids, self._participants_fallback_ids)

    def actions_for(self, scene: SceneContext, role: ActionRole) -> list[ActionInfo]:
        scene_data = SceneData.model_validate(scene.data)
        if scene_data.character_id is not None:
            return []
        return [
            ActionInfo(
                key=self.key,
                title="Инициатива",
                roles=["gm"],
                description="Ставки жетонов; при равенстве — тай-брейк d20",
            )
        ]

    def _participants_fallback_ids(self, participants_dict: dict[str, Any]) -> list[str]:
        ids: list[str] = []
        gm = (participants_dict or {}).get("gmUserId")
        if gm:
            ids.append(str(gm))
        for u in (participants_dict or {}).get("participants") or []:
            ids.append(str(u))
        return _uniq_str(ids)

    def _visible_ids(self, participants: ActionParticipants, wf: Workflow) -> list[str]:
        # audience = GM + rollers из контекста
        c = InitiativeWorkflowContext.model_validate(wf.context or {})
        ids = [str(participants.gmUserId)] + [str(r.userId) for r in (c.rollers or [])]
        return _uniq_str(ids)

    # ----------------
    # start
    # ----------------
    def start(self, action_context: ActionContext) -> SubmitResult:
        wf = Workflow(actionKey=self.key, stageKey=InitiativeBetStage.key, status="active")

        scene = action_context.scene
        data = SceneData.model_validate(scene.data)

        if data.character_id is not None:
            return SubmitResult(
                ok=False,
                issues=[{"path": "scene.data", "message": "Has character"}],
                workflow=dump(wf),
                participantIds=[],
            )

        entries: list[InitEntry] = []
        owners: list[UUID] = []

        # Снимаем доступные жетоны на стартовый момент
        for ch in (scene.characters or []):
            owner = action_context.links.characterToUserId.get(ch.id)
            ch_data = CharacterData.model_validate(ch.data)

            if ch_data.tokens <= 0:
                continue

            entries.append(
                InitEntry(
                    entityId=ch.id,
                    name=getattr(ch, "name", "") or "",
                    ownerUserId=owner,
                    available_tokens=ch_data.tokens,
                    spend_tokens=None,
                    tieRolled=False,
                    tieResult=None,
                )
            )

            if owner:
                owners.append(owner)

        # uniq owners
        seen_u: set[UUID] = set()
        owners_uniq: list[UUID] = []
        for u in owners:
            if u in seen_u:
                continue
            seen_u.add(u)
            owners_uniq.append(u)

        # Роллеры: все владельцы персонажей (они будут ставить; tie-roll — только часть из них)
        rollers: list[Roller] = []
        for e in entries:
            if e.ownerUserId is not None:
                rollers.append(Roller(userId=e.ownerUserId, entityId=e.entityId, name=e.name))

        ctx = InitiativeWorkflowContext(
            sceneId=scene.id,
            order=entries,
            currentIndex=0,
            rollers=rollers,
            tieEntityIds=[],  # на старте неизвестно
        )
        ctx.seek_next_unrolled()  # ок, если метод у тебя не ломает логику ставок
        wf.context = ctx.model_dump(mode="json")  # UUID -> str в json режиме [web:43]

        gm_id = action_context.participants.gmUserId
        participant_ids = [str(gm_id)] + [str(u) for u in owners_uniq]
        return SubmitResult(ok=True, issues=[], workflow=dump(wf), participantIds=participant_ids)

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
            links=action_context.links,
        )

        res = stage.submit(wf, ctx, action_context.input or {})

        # stage вернул ошибку -> ничего не оркестрируем
        if not isinstance(res, SubmitResult) or not res.ok:
            return res

        # -----------------------------
        # ORCHESTRATOR: transitions
        # -----------------------------
        try:
            c = InitiativeWorkflowContext.model_validate(wf.context or {})
        except Exception:
            # контекст сломан — не трогаем переходы
            return res

        def spent(e: InitEntry) -> int:
            return int(e.spend_tokens or 0)

        # 1) после ставок: если все поставили -> tie или result
        if wf.stageKey == "initiative.bet":
            if c.order and all(e.spend_tokens is not None for e in c.order):
                mx = max((spent(e) for e in c.order), default=0)
                tie_ids = [e.entityId for e in c.order if spent(e) == mx]
                c.tieEntityIds = tie_ids

                
                if len(tie_ids) > 1:
                    # ставим currentIndex на первого финалиста
                    for i, e in enumerate(c.order):
                        if e.entityId in tie_ids:
                            c.currentIndex = i
                            break
                    wf.stageKey = "initiative.tie_canvas"   # ← новое
                    wf.status = "active"
                else:
                    wf.stageKey = "initiative.result"
                    wf.status = "active"

                wf.context = c.model_dump(mode="json")
                # чтобы клиент сразу увидел новый stageKey
                return ctx.rb.result(
                    ok=True,
                    wf=wf,
                    participants=participants,
                    participants_dict_fallback=participants_dict,
                    issues=[],
                )
            
        if wf.stageKey == "initiative.tie_canvas":
            tie_set = set(str(x) for x in (c.tieEntityIds or []))
            all_drawn = all(
                e.canvas_seed is not None
                for e in c.order
                if str(e.entityId) in tie_set
            )
            if all_drawn:
                wf.stageKey = "initiative.tie_roll"
                wf.status = "active"
                wf.context = c.model_dump(mode="json")
                return ctx.rb.result(ok=True, wf=wf, participants=participants,
                                    participants_dict_fallback=participants_dict, issues=[])

        if prev_stage_key == "initiative.tie_roll":
            if isinstance(res, SubmitResult) and res.ok:
                try:
                    c2 = InitiativeWorkflowContext.model_validate(wf.context or {})
                except Exception:
                    return res
                # если stageKey уже tie_canvas (reroll) — просто возвращаем
                if wf.stageKey == "initiative.tie_canvas":
                    return res
                # иначе confirm → result
                wf.stageKey = "initiative.result"
                wf.status = "active"
                wf.context = c2.model_dump(mode="json")
                return ctx.rb.result(ok=True, wf=wf, participants=participants,
                                    participants_dict_fallback=participants_dict, issues=[])



        # 3) GM подтвердил на initiative.result -> finish
        if prev_stage_key == InitiativeResultStage.key:
            if isinstance(res, SubmitResult) and res.ok:
                try:
                    c2 = InitiativeWorkflowContext.model_validate(wf.context or {})
                except Exception:
                    return res
                return self._finish(action_context, wf, c2)

        return res


    # ----------------
    # finish helper
    # ----------------
    def _finish(self, action_context: ActionContext, wf: Workflow, ctx: InitiativeWorkflowContext) -> SubmitResult:
        entries = list(ctx.order)

        if not entries:
            return self._rb.result(
                ok=False,
                wf=wf,
                participants=ActionParticipants.model_validate(action_context.participants.model_dump(mode="json")),
                participants_dict_fallback=action_context.participants.model_dump(mode="json"),
                issues=[issue("context.order", "No entries")],
            )

        # валидация ставок
        for e in entries:
            if e.ownerUserId is None:
                return self._rb.result(
                    ok=False,
                    wf=wf,
                    participants=ActionParticipants.model_validate(action_context.participants.model_dump(mode="json")),
                    participants_dict_fallback=action_context.participants.model_dump(mode="json"),
                    issues=[issue("context.order", f"Entry {e.entityId} has no ownerUserId")],
                )
            if e.spend_tokens is None:
                return self._rb.result(
                    ok=False,
                    wf=wf,
                    participants=ActionParticipants.model_validate(action_context.participants.model_dump(mode="json")),
                    participants_dict_fallback=action_context.participants.model_dump(mode="json"),
                    issues=[issue("context.order", f"Entry {e.entityId} has no spend_tokens")],
                )
            if int(e.spend_tokens) > int(e.available_tokens):
                return self._rb.result(
                    ok=False,
                    wf=wf,
                    participants=ActionParticipants.model_validate(action_context.participants.model_dump(mode="json")),
                    participants_dict_fallback=action_context.participants.model_dump(mode="json"),
                    issues=[issue("context.order", f"Entry {e.entityId} spend_tokens > available_tokens")],
                )

        # победитель: spend desc, tie desc (tieResult может быть None -> 0)
        entries.sort(key=lambda e: (-_spent(e), -_tie(e), str(e.entityId)))
        winner = entries[0]

        buff = max(0, _spent(entries[0]) - _spent(entries[1])) if len(entries) >= 2 else 0

        winner_id: UUID = winner.entityId
        spent_tokens: int = _spent(winner)
        new_tokens = int(winner.available_tokens) - spent_tokens

        patch: dict[str, Any] = {
            "scenes": [
                {
                    "id": str(ctx.sceneId),
                    "dataPatch": SceneData(character_id=winner_id, buff=buff).model_dump(mode="json"),
                }
            ],
            "characters": [
                {
                    "id": str(winner_id),
                    # "dataPatch": CharacterData(tokens=new_tokens).model_dump(mode="json"),
                    "dataPatch":  {"tokens": new_tokens},
                }
            ],
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
