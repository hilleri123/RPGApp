from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from plugins.common.protocols import StageCtx
from plugins.common.protocols.workflow_stage import StageOutcome, issue
from plugins.common.types import ActionParticipants, SubmitResult, Workflow

from ..engine import expand_dw_choice_effects
from ..helpers import actor_data_from_scene, codex_moves_map, primary_move_id
from ..stage_store import DwStage
from ..types import PerformMoveContext, PerformMoveEntry


class ChoiceResolveItem(BaseModel):
    choice_id: str
    option_ids: list[str] = Field(default_factory=list)


class ChooseInput(BaseModel):
    choices: list[ChoiceResolveItem] = Field(default_factory=list)


class ChoosePatchInput(BaseModel):
    choices: list[ChoiceResolveItem] | None = None


class PerformMoveChooseStage(DwStage):
    key = "perform_move.choose"

    def _clear_entry_slice(self, entry: PerformMoveEntry, wf: Workflow | None = None) -> None:
        resolve = entry.resolve
        if wf is not None:
            data = self.get(wf)
            effects_from = int(data.get("effects_from") or 0)
            logs_from = int(data.get("logs_from") or 0)
            if effects_from and len(resolve.effects) > effects_from:
                resolve.effects = resolve.effects[:effects_from]
            if logs_from and len(resolve.log_lines) > logs_from:
                resolve.log_lines = resolve.log_lines[:logs_from]
        for pending in resolve.pending_choices:
            pending.resolved = False
            pending.resolved_option_ids = []

    def _clear_from_stored_data(self, wf: Workflow, entry: PerformMoveEntry) -> None:
        data = self.get(wf)
        if not data:
            return
        resolve = entry.resolve
        effects_from = int(data.get("effects_from") or 0)
        logs_from = int(data.get("logs_from") or 0)
        if effects_from and len(resolve.effects) > effects_from:
            resolve.effects = resolve.effects[:effects_from]
        if logs_from and len(resolve.log_lines) > logs_from:
            resolve.log_lines = resolve.log_lines[:logs_from]
        for pending in resolve.pending_choices:
            pending.resolved = False
            pending.resolved_option_ids = []

    def clear_data(self, wf: Workflow) -> None:
        super().clear_data(wf)

    def validate_patch(self, wf: Workflow, ctx: StageCtx, raw: dict[str, Any]) -> StageOutcome:
        parsed = ctx.rb.parse_input(ChoosePatchInput, raw, wf, ctx)
        if isinstance(parsed, SubmitResult):
            return StageOutcome(ok=False, issues=parsed.issues)
        if parsed.choices is None:
            return StageOutcome.ok_data(self.get(wf))
        return StageOutcome.ok_data({
            "choices": [c.model_dump(mode="json") for c in parsed.choices],
        })

    def apply_patch(self, wf: Workflow, ctx: StageCtx, data: dict[str, Any]) -> None:
        self.put(wf, data)

    def assemble(self, wf: Workflow, ctx: StageCtx, entry: PerformMoveEntry) -> None:
        data = self.get(wf)
        if not data or not data.get("choices"):
            return
        try:
            c = self._context(wf)
        except Exception:
            return
        self._clear_from_stored_data(wf, entry)
        moves_map = codex_moves_map(self.full_codex, actor_data_from_scene(c, ctx.scene))
        move_id = primary_move_id(c.entry)
        move = moves_map.get(move_id)
        if move is None and c.entry.moves:
            move = moves_map.get(c.entry.moves[0].id)
        if move is None:
            return

        resolve = entry.resolve
        by_id = {x.id: x for x in resolve.pending_choices}
        effects_from = len(resolve.effects)
        logs_from = len(resolve.log_lines)

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
                target_kind=entry.target_kind,
                target_character_id=entry.target_character_id,
                target_npc_id=entry.target_npc_id,
            )
            resolve.effects.extend(effects)
            resolve.log_lines.extend(logs)

        self.put(wf, {
            **data,
            "effects_from": effects_from,
            "logs_from": logs_from,
        })

    def _resolve_move(self, c: PerformMoveContext, ctx: StageCtx) -> Any:
        moves_map = codex_moves_map(self.full_codex, actor_data_from_scene(c, ctx.scene))
        move_id = primary_move_id(c.entry)
        move = moves_map.get(move_id)
        if move is None and c.entry.moves:
            move = moves_map.get(c.entry.moves[0].id)
        return move

    def validate_submit(self, wf: Workflow, ctx: StageCtx, raw: dict[str, Any]) -> StageOutcome:
        try:
            c = self._context(wf)
        except Exception as e:
            return StageOutcome.fail("context", str(e))

        parsed = ctx.rb.parse_input(ChooseInput, raw, wf, ctx)
        if isinstance(parsed, SubmitResult):
            return StageOutcome(ok=False, issues=parsed.issues)

        move = self._resolve_move(c, ctx)
        if move is None:
            return StageOutcome.fail("move", "Move not found")

        by_id = {x.id: x for x in c.entry.resolve.pending_choices}
        for item in parsed.choices:
            pending = by_id.get(item.choice_id)
            if pending is None:
                return StageOutcome.fail("choices", f"Unknown choice id: {item.choice_id}")
            required = max(1, int(pending.choose or 1))
            if len(item.option_ids) != required:
                return StageOutcome.fail(
                    "choices",
                    f"Choice '{item.choice_id}' requires exactly {required} option(s)",
                )
            allowed = {opt.id for opt in pending.options}
            if any(opt_id not in allowed for opt_id in item.option_ids):
                return StageOutcome.fail(
                    "choices",
                    f"Choice '{item.choice_id}' contains invalid option ids",
                )

        return StageOutcome.ok_data({
            "choices": [c_item.model_dump(mode="json") for c_item in parsed.choices],
        })

    def submit(self, wf: Workflow, ctx: StageCtx, data: dict[str, Any]) -> SubmitResult:
        try:
            c = self._context(wf)
        except Exception as e:
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("context", str(e))],
            )

        move = self._resolve_move(c, ctx)
        if move is None:
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("move", "Move not found")],
            )

        resolve = c.entry.resolve
        self._clear_from_stored_data(wf, c.entry)
        effects_from = len(resolve.effects)
        logs_from = len(resolve.log_lines)

        by_id = {x.id: x for x in resolve.pending_choices}
        for item in data.get("choices") or []:
            choice_id = str(item.get("choice_id") or "")
            option_ids = list(item.get("option_ids") or [])
            pending = by_id.get(choice_id)
            if pending is None:
                continue
            pending.resolved_option_ids = option_ids
            pending.resolved = True
            effects, logs = expand_dw_choice_effects(
                move=move,
                pending=pending,
                chosen_ids=option_ids,
                target_kind=c.entry.target_kind,
                target_character_id=c.entry.target_character_id,
                target_npc_id=c.entry.target_npc_id,
            )
            resolve.effects.extend(effects)
            resolve.log_lines.extend(logs)

        self.put(wf, {
            "choices": data.get("choices") or [],
            "effects_from": effects_from,
            "logs_from": logs_from,
        })

        moves_map = codex_moves_map(self.full_codex, actor_data_from_scene(c, ctx.scene))
        unresolved = [x for x in c.entry.resolve.pending_choices if not x.resolved]
        wf.context = c.model_dump(mode="json")

        return ctx.rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
        )

    def visibility(self, wf: Workflow, ctx: StageCtx, participants: ActionParticipants) -> list[str]:
        return self._gm_actor_helper_visibility(wf, ctx, participants)
