from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from plugins.common.protocols import StageCtx
from plugins.common.protocols.workflow_stage import StageOutcome, issue
from plugins.common.types import ActionParticipants, SubmitResult, Workflow
from plugins.pbta.base.backend.workflows.perform_move.stages.declare import (
    DeclareInput,
    DeclarePatchInput,
    empty_declare_draft,
    union_stats_for_moves,
)
from plugins.pbta.base.backend.workflows.perform_move.types import MoveRef

from ..helpers import (
    actor_data_from_scene,
    actor_resource_totals,
    codex_moves_map,
    list_consumable_bonuses,
    move_is_available,
)
from ..stage_store import DwStage
from ..types import PerformMoveContext
from ....scene_context import scene_context_tags


class _DeclareCheck(BaseModel):
    move_ids: list[str] = Field(default_factory=list)


class PerformMoveDeclareStage(DwStage):
    key = "perform_move.declare"

    def _moves_map(self, c: PerformMoveContext, ctx: StageCtx) -> dict:
        return codex_moves_map(self.full_codex, actor_data_from_scene(c, ctx.scene))

    def _context_tags(self, c: PerformMoveContext, ctx: StageCtx) -> set[str]:
        tags = {str(t) for t in (c.entry.scene_context_tags or [])}
        scene_tags = getattr(ctx.scene, "tags", None) or []
        tags.update(str(t) for t in scene_tags)
        scene_data = getattr(ctx.scene, "data", None) or {}
        if isinstance(scene_data, dict):
            tags.update(scene_context_tags(scene_data))
        return tags

    def _clear_entry_slice(self, entry: Any, wf: Workflow | None = None) -> None:
        entry.moves = []
        entry.roll.required = False
        entry.roll.stat_id = ""
        entry.roll.stat_value = 0
        entry.roll.base_modifier = 0
        entry.roll.local_bonus = 0

    def _merge_patch(self, wf: Workflow, ctx: StageCtx, patch: dict[str, Any]) -> dict[str, Any]:
        cur = dict(self.get(wf) or empty_declare_draft())
        if "move_ids" in patch:
            ids = [str(x) for x in (patch.get("move_ids") or [])]
            cur["move_ids"] = ids
            cur["move_id"] = ids[0] if ids else ""
        if patch.get("move_id") is not None and "move_ids" not in patch:
            cur["move_id"] = str(patch["move_id"])
        if patch.get("stat_id") is not None:
            cur["stat_id"] = str(patch["stat_id"])
        if patch.get("local_bonus") is not None:
            cur["local_bonus"] = int(patch["local_bonus"])
        if "consume_bonus_ids" in patch:
            cur["consume_bonus_ids"] = [str(x) for x in (patch.get("consume_bonus_ids") or [])]
        if patch.get("resource_bonus_total") is not None:
            cur["resource_bonus_total"] = int(patch["resource_bonus_total"] or 0)
        if patch.get("cast_spell_entry_id") is not None:
            cur["cast_spell_entry_id"] = str(patch.get("cast_spell_entry_id") or "")
        if patch.get("cast_spell_id") is not None:
            cur["cast_spell_id"] = str(patch.get("cast_spell_id") or "")
        if patch.get("cast_spell_title") is not None:
            cur["cast_spell_title"] = str(patch.get("cast_spell_title") or "")

        c = self._context(wf)
        moves_map = self._moves_map(c, ctx)
        move_ids = [str(x) for x in (cur.get("move_ids") or [])]
        available_stats = union_stats_for_moves(move_ids, moves_map)
        stat_id = str(cur.get("stat_id") or "")
        if stat_id and available_stats and stat_id not in available_stats:
            cur["stat_id"] = ""
        elif len(available_stats) == 1:
            cur["stat_id"] = next(iter(available_stats))
        return cur

    def validate_patch(self, wf: Workflow, ctx: StageCtx, raw: dict[str, Any]) -> StageOutcome:
        try:
            pre = self._context(wf)
        except Exception as e:
            return StageOutcome.fail("context", str(e))

        if not self._actor_or_gm(ctx, pre):
            return StageOutcome.fail("", "Only actor or GM can edit move draft")

        parsed = ctx.rb.parse_input(DeclarePatchInput, raw, wf, ctx)
        if isinstance(parsed, SubmitResult):
            return StageOutcome(ok=False, issues=parsed.issues)

        moves_map = self._moves_map(pre, ctx)
        patch_payload: dict[str, Any] = {}

        if parsed.move_ids is not None:
            for mid in parsed.move_ids:
                if mid not in moves_map:
                    return StageOutcome.fail("move_ids", f"Move not found: {mid}")
            actor_data = self._actor_data(pre, ctx)
            resources = actor_resource_totals(actor_data)
            context_tags = self._context_tags(pre, ctx)
            for mid in parsed.move_ids:
                move = moves_map.get(mid)
                if move and not move_is_available(
                    move,
                    actor_resources=resources,
                    context_tags=context_tags,
                    active_move_ids=set(moves_map.keys()),
                ):
                    return StageOutcome.fail(
                        "move_ids",
                        f"Move not available in current context: {mid}",
                    )
            patch_payload["move_ids"] = list(parsed.move_ids)
            patch_payload["stat_id"] = ""
            invalidate = True
        else:
            invalidate = False

        if parsed.stat_id is not None:
            patch_payload["stat_id"] = parsed.stat_id
        if parsed.local_bonus is not None:
            patch_payload["local_bonus"] = parsed.local_bonus
        if parsed.consume_bonus_ids is not None:
            patch_payload["consume_bonus_ids"] = list(parsed.consume_bonus_ids)
        if parsed.resource_bonus_total is not None:
            patch_payload["resource_bonus_total"] = int(parsed.resource_bonus_total)
        if parsed.cast_spell_entry_id is not None:
            patch_payload["cast_spell_entry_id"] = str(parsed.cast_spell_entry_id or "")
        if parsed.cast_spell_id is not None:
            patch_payload["cast_spell_id"] = str(parsed.cast_spell_id or "")
        if parsed.cast_spell_title is not None:
            patch_payload["cast_spell_title"] = str(parsed.cast_spell_title or "")

        merged = self._merge_patch(wf, ctx, patch_payload)
        return StageOutcome.ok_data(merged, reset_following=invalidate or bool(patch_payload))

    def apply_patch(self, wf: Workflow, ctx: StageCtx, data: dict[str, Any]) -> None:
        self.put(wf, data)

    def assemble(self, wf: Workflow, ctx: StageCtx, entry: Any) -> None:
        declare = self.get(wf)
        if not declare:
            return
        move_ids = [str(x) for x in (declare.get("move_ids") or [])]
        if not move_ids:
            return

        c = self._context(wf)
        moves_map = self._moves_map(c, ctx)
        resolved: list[MoveRef] = []
        for mid in move_ids:
            move = moves_map.get(mid)
            if move is None:
                continue
            resolved.append(MoveRef(id=move.id, title=move.title, kind=getattr(move, "kind", "")))
        if resolved:
            entry.moves = resolved

        available_stats = union_stats_for_moves(move_ids, moves_map)
        roll_required = len(available_stats) > 0
        entry.roll.required = roll_required
        entry.roll.local_bonus = int(declare.get("local_bonus") or 0)

        stat_id = str(declare.get("stat_id") or "")
        if roll_required and stat_id:
            actor = None
            if c.entry.actor_kind == "character" and c.entry.actor_character_id:
                actor = next(
                    (x for x in (ctx.scene.characters or []) if str(x.id) == str(c.entry.actor_character_id)),
                    None,
                )
            if actor and isinstance(actor.data, dict):
                stat_modifiers = actor.data.get("stat_modifiers", {})
                stats = actor.data.get("stats", {})
                entry.roll.stat_id = stat_id
                entry.roll.stat_value = int(stats.get(stat_id, 0))
                entry.roll.base_modifier = int(stat_modifiers.get(stat_id, 0))
        elif not roll_required:
            entry.roll.stat_id = ""
            entry.roll.stat_value = 0
            entry.roll.base_modifier = 0

    def _actor_data(self, c: PerformMoveContext, ctx: StageCtx) -> dict[str, Any]:
        if c.entry.actor_kind != "character" or not c.entry.actor_character_id:
            return {}
        ch = next(
            (x for x in (ctx.scene.characters or []) if str(x.id) == str(c.entry.actor_character_id)),
            None,
        )
        return ch.data if ch and isinstance(ch.data, dict) else {}

    def validate_submit(self, wf: Workflow, ctx: StageCtx, raw: dict[str, Any]) -> StageOutcome:
        try:
            c = self._context(wf)
        except Exception as e:
            return StageOutcome.fail("context", str(e))

        if not self._actor_or_gm(ctx, c):
            return StageOutcome.fail("", "Only actor or GM can choose move")

        parsed = ctx.rb.parse_input(DeclareInput, raw, wf, ctx)
        if isinstance(parsed, SubmitResult):
            return StageOutcome(ok=False, issues=parsed.issues)

        if not parsed.move_ids:
            return StageOutcome.fail("move_ids", "At least one move required")

        moves_map = self._moves_map(c, ctx)
        actor_data = self._actor_data(c, ctx)
        resources = actor_resource_totals(actor_data)
        context_tags = self._context_tags(c, ctx)

        for mid in parsed.move_ids:
            move = moves_map.get(mid)
            if move is None:
                return StageOutcome.fail("move_ids", f"Move not found: {mid}")
            if not move_is_available(
                move,
                actor_resources=resources,
                context_tags=context_tags,
                active_move_ids=set(moves_map.keys()),
            ):
                return StageOutcome.fail("move_ids", f"Move not available in current context: {mid}")

        return StageOutcome.ok_data({
            "move_ids": list(parsed.move_ids),
            "move_id": parsed.move_ids[0] if parsed.move_ids else "",
            "stat_id": parsed.stat_id,
            "local_bonus": parsed.local_bonus,
            "consume_bonus_ids": list(parsed.consume_bonus_ids or []),
            "resource_bonus_total": parsed.resource_bonus_total,
            "cast_spell_entry_id": str(parsed.cast_spell_entry_id or ""),
            "cast_spell_id": str(parsed.cast_spell_id or ""),
            "cast_spell_title": str(parsed.cast_spell_title or ""),
        })

    def submit(self, wf: Workflow, ctx: StageCtx, data: dict[str, Any]) -> SubmitResult:
        def err(field: str, msg: str) -> SubmitResult:
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue(field, msg)],
            )

        validation = self.validate_submit(wf, ctx, data)
        if not validation.ok:
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=validation.issues,
            )

        self.put(wf, dict(validation.data))
        self.assemble(wf, ctx, self._context(wf).entry)

        c = self._context(wf)
        moves_map = self._moves_map(c, ctx)
        move_ids = validation.data.get("move_ids", [])
        available_stats: set[str] = set()
        for mid in move_ids:
            move = moves_map.get(mid)
            if move:
                for s in getattr(move, "available_stats", []) or []:
                    available_stats.add(str(s))

        roll_required = len(available_stats) > 0
        c.entry.roll.required = roll_required
        c.entry.roll.local_bonus = int(validation.data.get("local_bonus") or 0)
        selected = list(validation.data.get("consume_bonus_ids") or [])
        c.entry.roll.temp_bonus_ids = selected

        actor_data = self._actor_data(c, ctx)
        available = list_consumable_bonuses(
            actor_data,
            stat_id=str(validation.data.get("stat_id") or ""),
            move_ids=move_ids,
        )
        by_id = {b["id"]: b for b in available}
        bonus_total = 0
        for bid in selected:
            b = by_id.get(bid)
            if not b:
                continue
            bonus_total += int(b.get("amount") or 0)
        if validation.data.get("resource_bonus_total") is not None:
            # client hint; trust computed sum from selected
            pass
        c.entry.resource_bonus_total = bonus_total

        c.entry.cast_spell_entry_id = str(validation.data.get("cast_spell_entry_id") or "")
        c.entry.cast_spell_id = str(validation.data.get("cast_spell_id") or "")
        c.entry.cast_spell_title = str(validation.data.get("cast_spell_title") or "")
        if not any(bool(getattr(moves_map.get(mid), "casts_spell", False)) for mid in move_ids):
            c.entry.cast_spell_entry_id = ""
            c.entry.cast_spell_id = ""
            c.entry.cast_spell_title = ""

        stat_id = str(validation.data.get("stat_id") or "")
        if roll_required:
            if not stat_id:
                return err("stat_id", "stat_id required for this move set")
            if stat_id not in available_stats:
                return err("stat_id", f"Stat '{stat_id}' not available for selected moves")
            actor = next(
                (x for x in (ctx.scene.characters or []) if str(x.id) == str(c.entry.actor_character_id)),
                None,
            )
            if actor is None:
                return err("actor", "Actor character not found")
            raw_actor = actor.data if isinstance(actor.data, dict) else {}
            c.entry.roll.stat_id = stat_id
            c.entry.roll.stat_value = int((raw_actor.get("stats") or {}).get(stat_id, 0))
            c.entry.roll.base_modifier = int((raw_actor.get("stat_modifiers") or {}).get(stat_id, 0))

        wf.context = c.model_dump(mode="json")
        wf.stageData = {
            **(wf.stageData or {}),
            "bonusOptions": available,
            "foSum": sum(int(b.get("amount") or 0) for b in available),
            "selectedBonusIds": selected,
            "resourceBonusTotal": bonus_total,
        }

        return ctx.rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
        )

    def visibility(self, wf: Workflow, ctx: StageCtx, participants: ActionParticipants) -> list[str]:
        return self._gm_actor_helper_visibility(wf, ctx, participants)
