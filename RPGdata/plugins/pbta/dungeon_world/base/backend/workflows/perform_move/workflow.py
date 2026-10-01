from __future__ import annotations

from typing import Any

from plugins.common.protocols import StageCtx, issue
from plugins.common.protocols.stage_base import dump
from plugins.common.protocols.workflow_stage import StageOutcome
from plugins.common.types import ActionContext, ActionParticipants, SubmitResult, Workflow
from plugins.pbta.base.backend.workflows.perform_move.helpers import attach_roll_stage_data, uniq

from ...codex import FullCodex
from ...initiative import active_entity_id, advance_after_actor, merge_patches, scene_patch
from .engine import expand_dw_choice_effects
from .helpers import (
    damage_quick_options,
    list_consumable_bonuses,
    list_move_matched_resources,
    moves_map_for_workflow,
    primary_move_id,
)
from .stage_store import (
    PIPELINE,
    POST_ROLL_INTERACTIVE,
    PRE_ROLL_SUBSTEPS,
    STAGE_LABELS,
    SUBSTEP_ORDER,
    assemble_context,
    furthest_stage_key,
    get_stage_data,
    is_roll_frozen,
    mark_progress,
    phase_for_substep,
    reset_entry_after,
    set_stage_data,
    stage_index,
    substep_index,
)
from .manifest_sync import claims_need_roll, prefill_manifest_from_entry, read_manifest, sync_claims_to_manifest_lines, write_manifest
from .stages import (
    PerformMoveAidStage,
    PerformMoveApplyStage,
    PerformMoveBonusesStage,
    PerformMoveChangeManifestStage,
    PerformMoveChooseStage,
    PerformMoveDamageApplyStage,
    PerformMoveDamageRollStage,
    PerformMoveDeclareStage,
    PerformMoveResolveStage,
    PerformMoveResourcesGrantStage,
    PerformMoveResultStage,
    PerformMoveRollStage,
    PerformMoveSetupStage,
    character_for_user,
)
from .types import PerformMoveContext
from plugins.pbta.base.backend.workflows.perform_move.types import EffectRecord
from ......base.backend.workflows.perform_move.workflow import PerformMoveWorkflow as PerformMoveWorkflowBase

PHASES_WITH_WIZARD = frozenset({"perform_move.pre_roll", "perform_move.post_roll"})

from .types_change_manifest import ChangeManifestState

PATCHABLE_SUBSTEPS = frozenset({
    "perform_move.declare",
    "perform_move.bonuses",
    "perform_move.aid",
    "perform_move.choose",
    "perform_move.change_manifest",
    "perform_move.damage_roll",
})

POST_ROLL_AUTO_AFTER_DAMAGE_ROLL: tuple[str, ...] = ()

VISIBILITY_PROXY = {
    "perform_move.pre_roll": "perform_move.declare",
    "perform_move.post_roll": "perform_move.change_manifest",
}


class PerformMoveWorkflow(PerformMoveWorkflowBase):
    def __init__(self, full_codex: FullCodex | None = None):
        super().__init__(full_codex or FullCodex())
        self._handlers = {
            PerformMoveSetupStage.key: PerformMoveSetupStage(self.full_codex),
            PerformMoveDeclareStage.key: PerformMoveDeclareStage(self.full_codex),
            PerformMoveBonusesStage.key: PerformMoveBonusesStage(self.full_codex),
            PerformMoveAidStage.key: PerformMoveAidStage(self.full_codex),
            PerformMoveRollStage.key: PerformMoveRollStage(self.full_codex),
            PerformMoveResolveStage.key: PerformMoveResolveStage(self.full_codex),
            PerformMoveChooseStage.key: PerformMoveChooseStage(self.full_codex),
            PerformMoveChangeManifestStage.key: PerformMoveChangeManifestStage(self.full_codex),
            PerformMoveDamageRollStage.key: PerformMoveDamageRollStage(self.full_codex),
            PerformMoveDamageApplyStage.key: PerformMoveDamageApplyStage(self.full_codex),
            PerformMoveApplyStage.key: PerformMoveApplyStage(self.full_codex),
            PerformMoveResourcesGrantStage.key: PerformMoveResourcesGrantStage(self.full_codex),
            PerformMoveResultStage.key: PerformMoveResultStage(self.full_codex),
        }
        self._setup: PerformMoveSetupStage = self._handlers[PerformMoveSetupStage.key]  # type: ignore[assignment]

    # --- public API ---

    def start(self, action_context: ActionContext) -> SubmitResult:
        participants_dict = action_context.participants.model_dump(mode="json")
        participants = ActionParticipants.model_validate(participants_dict)
        initiator = participants.initiatorUserId
        gm_id = participants.gmUserId

        base = super().start(action_context)
        if not base.ok or base.workflow is None:
            return base

        if initiator is None or initiator == gm_id:
            return base

        char = character_for_user(action_context.scene, action_context.links, initiator)
        if char is None:
            return self._rb.result(
                ok=False,
                wf=base.workflow,
                participants=participants,
                participants_dict_fallback=participants_dict,
                issues=[issue("", "Персонаж игрока не найден в сцене")],
            )

        ctx = StageCtx(
            scene=action_context.scene,
            actor_user_id=action_context.actorUserId,
            participants=participants,
            participants_dict=participants_dict,
            rb=self._rb,
            links=action_context.links,
        )
        result = self._setup.apply_actor_character(base.workflow, ctx, actor_character_id=char.id)
        if result.ok and result.workflow is not None:
            wf = result.workflow if isinstance(result.workflow, Workflow) else Workflow.model_validate(result.workflow)
            wf.stageKey = "perform_move.pre_roll"
            self._enter_phase(wf, "perform_move.pre_roll", ctx)
            c = PerformMoveContext.model_validate(wf.context or {})
            mark_progress(wf, PRE_ROLL_SUBSTEPS[0])
            self._attach_wizard(wf, c)
            result.workflow = dump(wf)
        return result

    def submit(self, action_context: ActionContext) -> SubmitResult:
        wf, ctx = self._ctx(action_context)
        if wf is None or ctx is None:
            return self._missing_wf(action_context)
        was_active = wf.status != "completed"
        result = self._submit(wf, ctx, action_context.input or {})
        if was_active:
            result = self._advance_initiative(action_context, result)
        return result

    def _advance_initiative(self, action_context: ActionContext, result: SubmitResult) -> SubmitResult:
        """Передаёт ход дальше, когда ход завершил тот, чья сейчас очередь.

        Срабатывает один раз — в момент перехода workflow в completed. Если
        ходил не активный участник (реакция, помощь), очередь не меняется.
        """
        if not result.ok or result.workflow is None:
            return result
        # стадии кладут в result.workflow то dict, то Workflow
        done = (
            Workflow.model_validate(result.workflow)
            if isinstance(result.workflow, dict)
            else result.workflow
        )
        if done.status != "completed":
            return result
        try:
            c = PerformMoveContext.model_validate(done.context or {})
        except Exception:
            return result

        entry = c.entry
        actor_id = entry.actor_npc_id if entry.actor_kind == "npc" else entry.actor_character_id

        scene = action_context.scene
        # Ход NPC ведёт мастер: NPC — источник хода (`source_npc_id`), а бросает персонаж.
        # Очередь двигаем, если текущим по инициативе был либо NPC-источник, либо актор.
        candidates = [str(x) for x in (entry.source_npc_id, actor_id) if x]
        if not candidates:
            return result
        active_id = active_entity_id(scene.data)
        turn_owner = next((x for x in candidates if x == active_id), candidates[-1])

        present = [str(x.id) for x in (scene.characters or [])] + [str(x.id) for x in (scene.npcs or [])]
        new_ini = advance_after_actor(scene.data, turn_owner, present)
        if new_ini is None:
            return result

        result.sessionPatch = merge_patches(result.sessionPatch, scene_patch(scene.id, new_ini))
        return result

    def patch(self, action_context: ActionContext) -> SubmitResult:
        wf, ctx = self._ctx(action_context)
        if wf is None or ctx is None:
            return self._missing_wf(action_context)
        sub_key, patch_input = self._extract_patch_target(action_context.input or {}, wf)
        return self._patch(wf, ctx, sub_key, patch_input)

    def _visible_ids(self, participants: ActionParticipants, wf: Workflow) -> list[str]:
        ctx_stub = StageCtx(
            scene=None,  # type: ignore[arg-type]
            actor_user_id=participants.gmUserId,
            participants=participants,
            participants_dict=participants,
            rb=self._rb,
            links=None,  # type: ignore[arg-type]
        )
        phase = wf.stageKey or ""
        wizard = (wf.stageData or {}).get("wizard") or {}
        current = str(wizard.get("currentKey") or "")
        # На стадии броска HP — видимость самой damage_roll (включает rollers)
        if phase == "perform_move.post_roll" and current == "perform_move.damage_roll":
            vis_key = "perform_move.damage_roll"
        else:
            vis_key = VISIBILITY_PROXY.get(phase, phase)
        st = self._handlers.get(vis_key)
        if st is None:
            return [str(participants.gmUserId)]
        ids = list(st.visibility(wf, ctx_stub, participants) or [])
        # Rollers всегда видят экшен, пока есть их заявки
        try:
            c = PerformMoveContext.model_validate(wf.context or {})
            for claim in c.entry.damage_claims or []:
                if claim.roller_user_id:
                    ids.append(str(claim.roller_user_id))
        except Exception:
            pass
        return uniq(ids)

    # --- patch / submit ---

    def _patch(self, wf: Workflow, ctx: StageCtx, sub_key: str, raw: dict[str, Any]) -> SubmitResult:
        if sub_key not in PATCHABLE_SUBSTEPS:
            return self._err(wf, ctx, "", "Stage does not support patch")

        st = self._handlers.get(sub_key)
        if st is None:
            return self._err(wf, ctx, "stageKey", f"Unknown stage: {sub_key}")

        try:
            c = PerformMoveContext.model_validate(wf.context or {})
        except Exception as e:
            return self._err(wf, ctx, "context", str(e))

        if not self._can_patch_substep(ctx, c, sub_key):
            return self._err(wf, ctx, "", "Нет прав на редактирование этой стадии")

        if not self._is_substep_editable(wf, c, sub_key):
            return self._err(wf, ctx, "", "This stage is read-only")

        clean = {k: v for k, v in (raw or {}).items() if not str(k).startswith("_")}
        prev = get_stage_data(wf, sub_key)
        issues = self._stage_patch(st, wf, ctx, clean)
        if issues:
            return self._rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=issues,
            )

        # Roller-патч damage_roll не сбрасывает последующие стадии
        if get_stage_data(wf, sub_key) != prev and self._can_edit_actor(ctx, c):
            self._reset_after_substep(wf, sub_key)

        self._sync_context(wf, ctx)
        c = PerformMoveContext.model_validate(wf.context or {})
        self._attach_wizard(wf, c)

        return self._rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
        )

    def _submit(self, wf: Workflow, ctx: StageCtx, raw: dict[str, Any]) -> SubmitResult:
        phase = wf.stageKey or ""
        payload = dict(raw or {})
        sub_key = str(payload.pop("_stageKey", "") or self._wizard_current_key(wf) or phase)

        if phase in PHASES_WITH_WIZARD:
            return self._submit_wizard_phase(wf, ctx, phase, sub_key, payload)

        st = self._handlers.get(phase)
        if st is None:
            return self._err(wf, ctx, "", "Unknown stage")

        result = self._run_stage_submit(st, wf, ctx, payload)
        if not result.ok or result.workflow is None:
            return result

        wf_obj = Workflow.model_validate(result.workflow) if isinstance(result.workflow, dict) else result.workflow
        c = PerformMoveContext.model_validate(wf_obj.context or {})
        next_phase = self._next_phase(phase, wf_obj, c)
        wf_obj.stageKey = next_phase
        self._enter_phase(wf_obj, next_phase, ctx, from_phase=phase, c=c)
        mark_progress(wf_obj, sub_key if sub_key in SUBSTEP_ORDER else phase)
        self._sync_context(wf_obj, ctx)
        c = PerformMoveContext.model_validate(wf_obj.context or {})
        self._attach_wizard(wf_obj, c)
        if next_phase == "completed":
            wf_obj.status = "completed"
        result.workflow = dump(wf_obj)
        return result

    def _submit_wizard_phase(
        self,
        wf: Workflow,
        ctx: StageCtx,
        phase: str,
        sub_key: str,
        payload: dict[str, Any],
    ) -> SubmitResult:
        try:
            c0 = PerformMoveContext.model_validate(wf.context or {})
        except Exception as e:
            return self._err(wf, ctx, "context", str(e))
        if not self._can_submit_substep(ctx, c0, sub_key):
            return self._err(wf, ctx, "", "Нет прав на завершение этой стадии")

        st = self._handlers.get(sub_key)
        if st is None:
            return self._err(wf, ctx, "stageKey", f"Unknown sub-stage: {sub_key}")

        result = self._run_stage_submit(st, wf, ctx, payload)
        if not result.ok or result.workflow is None:
            return result

        wf_obj = Workflow.model_validate(result.workflow) if isinstance(result.workflow, dict) else result.workflow
        c = PerformMoveContext.model_validate(wf_obj.context or {})
        self._after_substep_submit(sub_key, wf_obj, c, ctx)
        c = PerformMoveContext.model_validate(wf_obj.context or {})
        result = self._attach_accumulated_session_patch(wf_obj, result)

        manifest_route = (wf_obj.stageData or {}).get("manifestNext") if isinstance(wf_obj.stageData, dict) else None
        if manifest_route and sub_key == "perform_move.change_manifest":
            wf_obj.stageData = {**(wf_obj.stageData or {}), "manifestNext": None}
            if manifest_route == "stay":
                # игрок отправил заявку мастеру: остаёмся на заявке до его решения
                wf_obj.stageKey = phase
                self._set_wizard_current_key(wf_obj, "perform_move.change_manifest")
                mark_progress(wf_obj, "perform_move.change_manifest")
                self._sync_context(wf_obj, ctx)
                c = PerformMoveContext.model_validate(wf_obj.context or {})
                self._attach_wizard(wf_obj, c)
                result.workflow = dump(wf_obj)
                return self._attach_accumulated_session_patch(wf_obj, result)
            if manifest_route == "damage_roll":
                wf_obj.stageKey = phase
                self._set_wizard_current_key(wf_obj, "perform_move.damage_roll")
                mark_progress(wf_obj, "perform_move.damage_roll")
                self._sync_context(wf_obj, ctx)
                c = PerformMoveContext.model_validate(wf_obj.context or {})
                self._attach_wizard(wf_obj, c)
                result.workflow = dump(wf_obj)
                return self._attach_accumulated_session_patch(wf_obj, result)
            if manifest_route == "review":
                wf_obj.stageKey = phase
                self._set_wizard_current_key(wf_obj, "perform_move.change_manifest")
                mark_progress(wf_obj, "perform_move.change_manifest")
                self._sync_context(wf_obj, ctx)
                c = PerformMoveContext.model_validate(wf_obj.context or {})
                self._attach_wizard(wf_obj, c)
                result.workflow = dump(wf_obj)
                return self._attach_accumulated_session_patch(wf_obj, result)
            if manifest_route == "apply":
                self._finalize_manifest_apply(wf_obj, ctx)
                c = PerformMoveContext.model_validate(wf_obj.context or {})
                next_phase = "perform_move.result"
                wf_obj.stageKey = next_phase
                self._enter_phase(wf_obj, next_phase, ctx, from_phase=phase, c=c)
                mark_progress(wf_obj, "perform_move.change_manifest")
                self._sync_context(wf_obj, ctx)
                c = PerformMoveContext.model_validate(wf_obj.context or {})
                self._attach_wizard(wf_obj, c)
                wf_obj.status = "completed"
                result.workflow = dump(wf_obj)
                return self._attach_accumulated_session_patch(wf_obj, result)

        if sub_key == "perform_move.damage_roll":
            sync_claims_to_manifest_lines(wf_obj, c)
            state = read_manifest(wf_obj)
            state.mode = "review"
            write_manifest(wf_obj, state)
            wf_obj.stageKey = phase
            self._set_wizard_current_key(wf_obj, "perform_move.change_manifest")
            mark_progress(wf_obj, "perform_move.change_manifest")
            self._sync_context(wf_obj, ctx)
            c = PerformMoveContext.model_validate(wf_obj.context or {})
            self._attach_wizard(wf_obj, c)
            result.workflow = dump(wf_obj)
            return self._attach_accumulated_session_patch(wf_obj, result)

        next_sub = self._next_substep(phase, sub_key, wf_obj, c)
        if next_sub:
            wf_obj.stageKey = phase
            self._set_wizard_current_key(wf_obj, next_sub)
            mark_progress(wf_obj, next_sub)
            self._sync_context(wf_obj, ctx)
            c = PerformMoveContext.model_validate(wf_obj.context or {})
            self._attach_wizard(wf_obj, c)
            result.workflow = dump(wf_obj)
            result = self._attach_accumulated_session_patch(wf_obj, result)
            return result

        next_phase = self._next_phase(phase, wf_obj, c)
        wf_obj.stageKey = next_phase
        self._enter_phase(wf_obj, next_phase, ctx, from_phase=phase, c=c)
        mark_progress(wf_obj, sub_key)
        self._sync_context(wf_obj, ctx)
        c = PerformMoveContext.model_validate(wf_obj.context or {})
        self._attach_wizard(wf_obj, c)
        if next_phase == "completed":
            wf_obj.status = "completed"
        result.workflow = dump(wf_obj)
        result = self._attach_accumulated_session_patch(wf_obj, result)
        return result

    def _attach_accumulated_session_patch(self, wf: Workflow, result: SubmitResult) -> SubmitResult:
        patch = (wf.stageData or {}).get("sessionPatch") if isinstance(wf.stageData, dict) else None
        if patch:
            result.sessionPatch = patch
        return result

    def _refresh_bonus_options(self, wf: Workflow, ctx: StageCtx, c: PerformMoveContext) -> None:
        actor = None
        if c.entry.actor_kind == "character" and c.entry.actor_character_id:
            actor = next(
                (x for x in (ctx.scene.characters or []) if str(x.id) == str(c.entry.actor_character_id)),
                None,
            )
        actor_data = actor.data if actor and isinstance(actor.data, dict) else {}
        move_ids = [m.id for m in c.entry.moves]
        wf.stageData = {
            **(wf.stageData or {}),
            "bonusOptions": list_consumable_bonuses(
                actor_data,
                stat_id=c.entry.roll.stat_id or "",
                move_ids=move_ids,
            ),
            "moveResourceOptions": list_move_matched_resources(
                actor_data,
                move_ids=move_ids,
                stat_id=c.entry.roll.stat_id or "",
            ),
        }

    def _run_stage_submit(self, st, wf: Workflow, ctx: StageCtx, raw: dict[str, Any]) -> SubmitResult:
        submit_fn = getattr(st, "submit", None)
        if not callable(submit_fn):
            return self._err(wf, ctx, "", "Stage has no submit handler")

        validate = getattr(st, "validate_submit", None)
        if callable(validate):
            outcome = validate(wf, ctx, raw or {})
            if isinstance(outcome, StageOutcome) and not outcome.ok:
                return self._rb.result(
                    ok=False,
                    wf=wf,
                    participants=ctx.participants,
                    participants_dict_fallback=ctx.participants_dict,
                    issues=outcome.issues,
                )
            data = outcome.data if isinstance(outcome, StageOutcome) else (raw or {})
            return submit_fn(wf, ctx, data)
        return submit_fn(wf, ctx, raw or {})

    # --- phases ---

    def _next_phase(self, from_phase: str, wf: Workflow, c: PerformMoveContext) -> str:
        if from_phase == "perform_move.setup":
            return "perform_move.pre_roll"
        if from_phase == "perform_move.pre_roll":
            return "perform_move.roll" if c.entry.roll.required else "perform_move.post_roll"
        if from_phase == "perform_move.roll":
            return "perform_move.post_roll"
        if from_phase == "perform_move.post_roll":
            return "perform_move.result"
        if from_phase == "perform_move.result":
            return "completed"
        return wf.stageKey or from_phase

    def _enter_phase(
        self,
        wf: Workflow,
        phase: str,
        ctx: StageCtx,
        *,
        from_phase: str = "",
        c: PerformMoveContext | None = None,
    ) -> None:
        c = c or PerformMoveContext.model_validate(wf.context or {})

        if phase == "perform_move.pre_roll":
            self._init_wizard_substep(wf, PRE_ROLL_SUBSTEPS[0])

        if phase == "perform_move.post_roll":
            resolve = self._handlers.get("perform_move.resolve")
            if resolve is not None:
                self._run_stage_submit(resolve, wf, ctx, {})
                c = PerformMoveContext.model_validate(wf.context or {})
            PerformMoveChangeManifestStage.ensure_initialized(wf, c)
            first = self._first_post_roll_substep(wf, c)
            self._init_wizard_substep(wf, first or "perform_move.change_manifest")
            wf.stageData = {
                **(wf.stageData or {}),
                "damageQuickOptions": damage_quick_options(ctx.scene, self.full_codex),
            }

        if phase == "perform_move.roll":
            # Advance wizard onto roll — otherwise furthest stays on last pre_roll
            # substep and the roll step is marked disabled ("ещё не наступила").
            self._init_wizard_substep(wf, "perform_move.roll")
            if from_phase == "perform_move.pre_roll" and c.entry.roll.required:
                attach_roll_stage_data(wf, c)

        if phase == "perform_move.result":
            wf.status = "completed"

    def _next_substep(self, phase: str, sub_key: str, wf: Workflow, c: PerformMoveContext) -> str | None:
        if phase == "perform_move.pre_roll":
            steps = PRE_ROLL_SUBSTEPS
            try:
                idx = steps.index(sub_key)
            except ValueError:
                return None
            return steps[idx + 1] if idx + 1 < len(steps) else None

        if phase == "perform_move.post_roll":
            return self._next_post_roll_substep(sub_key, wf, c)
        return None

    def _post_roll_wizard_steps(self, wf: Workflow, c: PerformMoveContext) -> list[str]:
        steps: list[str] = []
        if any(not x.resolved for x in c.entry.resolve.pending_choices):
            steps.append("perform_move.choose")
        steps.append("perform_move.change_manifest")
        if claims_need_roll(c):
            steps.append("perform_move.damage_roll")
        return steps

    def _first_post_roll_substep(self, wf: Workflow, c: PerformMoveContext) -> str | None:
        steps = self._post_roll_wizard_steps(wf, c)
        return steps[0] if steps else None

    def _next_post_roll_substep(self, sub_key: str, wf: Workflow, c: PerformMoveContext) -> str | None:
        if sub_key == "perform_move.choose":
            if any(not x.resolved for x in c.entry.resolve.pending_choices):
                return "perform_move.choose"
            return "perform_move.change_manifest"

        if sub_key == "perform_move.change_manifest":
            return None

        if sub_key == "perform_move.damage_roll":
            return None

        return None

    @staticmethod
    def _record_complication(c: PerformMoveContext) -> None:
        """Косяк мастера на 7–9 попадает в итог хода (эффект gm_directive) и в журнал."""
        text = (c.entry.gm_complication or "").strip()
        if not text or c.entry.roll.outcome != "hit_7_9":
            return
        if not any(e.payload.get("complication") for e in c.entry.resolve.effects):
            c.entry.resolve.effects.append(
                EffectRecord(
                    kind="gm_directive",
                    payload={"text": text, "complication": True},
                    text=text,
                    applied=True,
                )
            )
        line = f"Косяк (7–9): {text}"
        if line not in c.entry.resolve.log_lines:
            c.entry.resolve.log_lines.append(line)

    @staticmethod
    def _record_npc_source(c: PerformMoveContext) -> None:
        """NPC-«повод» хода и его атака попадают в журнал итога."""
        entry = c.entry
        if not entry.source_npc_id:
            return
        name = entry.source_npc_name or "NPC"
        attack = entry.npc_attack
        line = f"{name}: {attack.description}" if attack and attack.description else f"{name} провоцирует ход"
        if line not in entry.resolve.log_lines:
            entry.resolve.log_lines.append(line)

    def _finalize_manifest_apply(self, wf: Workflow, ctx: StageCtx) -> None:
        import logging

        log = logging.getLogger("myapp")
        c = PerformMoveContext.model_validate(wf.context or {})
        self._record_complication(c)
        self._record_npc_source(c)
        wf.stageData = {**(wf.stageData or {}), "complicationRecorded": True}
        grants_payload = [g.model_dump(mode="json") for g in (c.entry.resource_grants or [])]
        c.entry.resource_grants = []
        spell_spend_id = ""
        if (
            c.entry.cast_spell_entry_id
            and c.entry.actor_kind == "character"
            and c.entry.actor_character_id
            and bool(getattr(c.entry, "unprepare_cast_spell", True))
        ):
            spell_spend_id = str(c.entry.cast_spell_entry_id)
        wf.context = c.model_dump(mode="json")

        claims = list(c.entry.damage_claims or [])
        damage_apply = self._handlers.get("perform_move.damage_apply")
        if damage_apply is not None and claims:
            result = self._run_stage_submit(damage_apply, wf, ctx, {})
            if not result.ok:
                log.error(
                    "damage_apply failed during manifest finalize issues=%s",
                    result.issues,
                )
            if result.workflow is not None:
                dumped = dump(result.workflow) if not isinstance(result.workflow, dict) else result.workflow
                if isinstance(dumped, dict):
                    wf.context = dumped.get("context") or wf.context
                    if isinstance(dumped.get("stageData"), dict):
                        wf.stageData = {**(wf.stageData or {}), **dumped["stageData"]}
            if result.sessionPatch:
                from .helpers import merge_session_patch

                merge_session_patch(wf, result.sessionPatch)

            patch = (wf.stageData or {}).get("sessionPatch") if isinstance(wf.stageData, dict) else None
            if not patch:
                log.error(
                    "damage_apply produced empty sessionPatch for %s claims",
                    len(claims),
                )

        if grants_payload or spell_spend_id:
            grant_st = self._handlers.get("perform_move.resources_grant")
            if grant_st is not None:
                grant_payload: dict[str, Any] = {
                    "grants": grants_payload,
                    "skip": False,
                    "mark_done": True,
                }
                if spell_spend_id:
                    grant_payload["spell_spend_entry_id"] = spell_spend_id
                    grant_payload["spell_spend_unprepare"] = True
                self._run_stage_submit(grant_st, wf, ctx, grant_payload)

        apply_st = self._handlers.get("perform_move.apply")
        if apply_st is not None:
            self._run_stage_submit(apply_st, wf, ctx, {})

    def _after_substep_submit(
        self,
        sub_key: str,
        wf: Workflow,
        c: PerformMoveContext,
        ctx: StageCtx,
    ) -> None:
        if sub_key == "perform_move.declare":
            if c.entry.roll.required:
                attach_roll_stage_data(wf, c)
            self._refresh_bonus_options(wf, ctx, c)
            wf.stageData = {
                **(wf.stageData or {}),
                "selectedBonusIds": [],
            }

        if sub_key == "perform_move.bonuses":
            self._refresh_bonus_options(wf, ctx, c)

        if sub_key == "perform_move.aid" and c.entry.roll.required:
            attach_roll_stage_data(wf, c)

        if sub_key == "perform_move.damage_roll":
            for auto_key in POST_ROLL_AUTO_AFTER_DAMAGE_ROLL:
                st = self._handlers.get(auto_key)
                if st is not None:
                    self._run_stage_submit(st, wf, ctx, {})

    # --- stage data ---

    @staticmethod
    def _stage_patch(st, wf: Workflow, ctx: StageCtx, delta: dict[str, Any]) -> list[dict[str, Any]]:
        validate = getattr(st, "validate_patch", None)
        if callable(validate):
            outcome = validate(wf, ctx, delta)
            if isinstance(outcome, StageOutcome):
                if not outcome.ok:
                    return outcome.issues
                apply = getattr(st, "apply_patch", None)
                if callable(apply):
                    apply(wf, ctx, outcome.data)
                elif hasattr(st, "put"):
                    st.put(wf, outcome.data)
                else:
                    set_stage_data(wf, st.key, outcome.data)
                return []
        patch_fn = getattr(st, "patch", None)
        if callable(patch_fn):
            return patch_fn(wf, ctx, delta)
        cur = get_stage_data(wf, st.key)
        cur.update(delta)
        set_stage_data(wf, st.key, cur)
        return []

    def _reset_after_substep(self, wf: Workflow, sub_key: str) -> None:
        try:
            c = PerformMoveContext.model_validate(wf.context or {})
        except Exception:
            return
        idx = substep_index(sub_key)
        for key in SUBSTEP_ORDER:
            if substep_index(key) > idx:
                st = self._handlers.get(key)
                if st is not None and hasattr(st, "clear"):
                    st.clear(wf)
                else:
                    set_stage_data(wf, key, {})
        reset_entry_after(c.entry, sub_key)
        wf.context = c.model_dump(mode="json")
        phase = phase_for_substep(sub_key)
        if phase and stage_index(wf.stageKey or "") > stage_index(phase):
            wf.stageKey = phase
        self._set_wizard_current_key(wf, sub_key)

    def _sync_context(self, wf: Workflow, ctx: StageCtx) -> PerformMoveContext:
        c = PerformMoveContext.model_validate(wf.context or {})
        assemble_context(wf, ctx, c)
        self._sync_roll_from_stage(wf, c)
        self._sync_choose_from_stage(wf, c)
        if (wf.stageData or {}).get("complicationRecorded"):
            # пересборка эффектов выбора не должна терять косяк мастера
            self._record_complication(c)
            self._record_npc_source(c)
        wf.context = c.model_dump(mode="json")
        return c

    @staticmethod
    def _sync_roll_from_stage(wf: Workflow, c: PerformMoveContext) -> None:
        data = get_stage_data(wf, "perform_move.roll")
        if not data or not data.get("roll_seed"):
            return
        dice = list(data.get("dice") or [])
        if len(dice) < 2:
            return
        c.entry.roll.roll_seed = str(data["roll_seed"])
        c.entry.roll.dice = dice
        c.entry.roll.total = int(data.get("total") or 0)
        outcome = data.get("outcome")
        c.entry.roll.outcome = outcome if outcome else None
        c.entry.roll.result_text = str(data.get("result_text") or "")

    def _sync_choose_from_stage(self, wf: Workflow, c: PerformMoveContext) -> None:
        data = get_stage_data(wf, "perform_move.choose")
        if not data or not data.get("choices"):
            return

        moves_map = self._moves_map(wf, c)
        move_id = primary_move_id(c.entry)
        move = moves_map.get(move_id)
        if move is None and c.entry.moves:
            move = moves_map.get(c.entry.moves[0].id)
        if move is None:
            return

        effects_from = int(data.get("effects_from") or 0)
        logs_from = int(data.get("logs_from") or 0)
        if effects_from and len(c.entry.resolve.effects) > effects_from:
            c.entry.resolve.effects = c.entry.resolve.effects[:effects_from]
        if logs_from and len(c.entry.resolve.log_lines) > logs_from:
            c.entry.resolve.log_lines = c.entry.resolve.log_lines[:logs_from]

        by_id = {x.id: x for x in c.entry.resolve.pending_choices}
        for item in data.get("choices") or []:
            choice_id = str(item.get("choice_id") or "")
            option_ids = list(item.get("option_ids") or [])
            pending = by_id.get(choice_id)
            if pending is None:
                continue
            pending.resolved_option_ids = option_ids
            pending.resolved = bool(option_ids)
            effects, logs = expand_dw_choice_effects(
                move=move,
                pending=pending,
                chosen_ids=option_ids,
                target_kind=c.entry.target_kind,
                target_character_id=c.entry.target_character_id,
                target_npc_id=c.entry.target_npc_id,
            )
            c.entry.resolve.effects.extend(effects)
            c.entry.resolve.log_lines.extend(logs)

    def _moves_map(self, wf: Workflow, c: PerformMoveContext | None = None) -> dict:
        return moves_map_for_workflow(wf, self.full_codex, c=c)

    # --- wizard (inside plugin) ---

    @staticmethod
    def _wizard_current_key(wf: Workflow) -> str:
        wizard = (wf.stageData or {}).get("wizard") or {}
        return str(wizard.get("currentKey") or "")

    @staticmethod
    def _set_wizard_current_key(wf: Workflow, key: str) -> None:
        sd = dict(wf.stageData or {})
        wizard = dict(sd.get("wizard") or {})
        wizard["currentKey"] = key
        sd["wizard"] = wizard
        wf.stageData = sd

    @staticmethod
    def _init_wizard_substep(wf: Workflow, key: str) -> None:
        sd = dict(wf.stageData or {})
        wizard = dict(sd.get("wizard") or {})
        wizard["currentKey"] = key
        wizard["furthestKey"] = key
        sd["wizard"] = wizard
        wf.stageData = sd

    def _attach_wizard(self, wf: Workflow, c: PerformMoveContext) -> None:
        phase = wf.stageKey or ""
        roll_frozen = is_roll_frozen(c)
        furthest = furthest_stage_key(wf)

        if phase == "perform_move.pre_roll":
            substeps = list(PRE_ROLL_SUBSTEPS)
            current = self._wizard_current_key(wf) or substeps[0]
        elif phase == "perform_move.post_roll":
            substeps = self._post_roll_wizard_steps(wf, c)
            current = self._wizard_current_key(wf) or (substeps[0] if substeps else "")
        elif phase == "perform_move.roll":
            substeps = ["perform_move.roll"]
            current = "perform_move.roll"
        elif phase == "perform_move.setup":
            substeps = ["perform_move.setup"]
            current = "perform_move.setup"
        elif phase == "perform_move.result":
            substeps = ["perform_move.result"]
            current = "perform_move.result"
        else:
            substeps = []
            current = phase

        steps: list[dict] = []
        # Never treat the active wizard step as "pending / not yet arrived".
        if current and substep_index(current) > substep_index(furthest):
            furthest = current
        for key in substeps:
            pending = substep_index(key) > substep_index(furthest)
            frozen = roll_frozen and key in PRE_ROLL_SUBSTEPS
            readonly = pending or frozen
            steps.append({
                "key": key,
                "label": STAGE_LABELS.get(key, key),
                "status": "current" if key == current else ("pending" if pending else "done"),
                "readonly": readonly,
                "disabled": pending,
                "frozen": frozen,
                "editable": self._is_substep_editable(wf, c, key) and not pending,
            })

        wf.stageData = {
            **(wf.stageData or {}),
            "wizard": {
                "phase": phase,
                "steps": steps,
                "currentKey": current,
                "furthestKey": furthest,
                "frozenThrough": "perform_move.aid" if roll_frozen else None,
                "rollFrozen": roll_frozen,
            },
        }

    # --- helpers ---

    @staticmethod
    def _extract_patch_target(input_dict: dict[str, Any], wf: Workflow) -> tuple[str, dict[str, Any]]:
        data = dict(input_dict or {})
        wizard = (wf.stageData or {}).get("wizard") or {}
        default = str(wizard.get("currentKey") or wf.stageKey or "")
        target = str(data.pop("_stageKey", "") or default)
        return target, data

    @staticmethod
    def _can_edit_actor(ctx: StageCtx, c: PerformMoveContext) -> bool:
        return str(ctx.actor_user_id) in (
            str(c.entry.actor_user_id),
            str(ctx.participants.gmUserId),
        )

    @staticmethod
    def _is_damage_roller(ctx: StageCtx, c: PerformMoveContext) -> bool:
        uid = str(ctx.actor_user_id)
        return any(
            cl.roller_user_id and str(cl.roller_user_id) == uid
            for cl in (c.entry.damage_claims or [])
        )

    def _can_patch_substep(self, ctx: StageCtx, c: PerformMoveContext, sub_key: str) -> bool:
        if self._can_edit_actor(ctx, c):
            return True
        return sub_key == "perform_move.damage_roll" and self._is_damage_roller(ctx, c)

    def _can_submit_substep(self, ctx: StageCtx, c: PerformMoveContext, sub_key: str) -> bool:
        # Rollers могут только патчить свои кубы; завершает стадию мастер/актор
        return self._can_edit_actor(ctx, c)

    @staticmethod
    def _is_substep_editable(wf: Workflow, c: PerformMoveContext, sub_key: str) -> bool:
        if sub_key in ("perform_move.resolve", "perform_move.damage_apply", "perform_move.apply"):
            return False
        if substep_index(sub_key) > substep_index(furthest_stage_key(wf)):
            return False
        if is_roll_frozen(c) and sub_key in PRE_ROLL_SUBSTEPS:
            return False
        if sub_key == "perform_move.roll" and is_roll_frozen(c):
            return False
        return True

    def _ctx(self, action_context: ActionContext) -> tuple[Workflow | None, StageCtx | None]:
        wf = action_context.workflow
        if wf is None:
            return None, None
        participants_dict = action_context.participants.model_dump(mode="json")
        participants = ActionParticipants.model_validate(participants_dict)
        return wf, StageCtx(
            scene=action_context.scene,
            actor_user_id=action_context.actorUserId,
            participants=participants,
            participants_dict=participants_dict,
            rb=self._rb,
            links=action_context.links,
        )

    def _missing_wf(self, action_context: ActionContext) -> SubmitResult:
        return self._rb.result(
            ok=False,
            wf=None,
            participants=None,
            participants_dict_fallback=action_context.participants.model_dump(mode="json"),
            issues=[issue("workflow", "Missing")],
        )

    def _err(self, wf: Workflow, ctx: StageCtx, path: str, msg: str) -> SubmitResult:
        return self._rb.result(
            ok=False,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[issue(path, msg)],
        )
