from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from plugins.common.protocols import BaseStage, StageCtx, issue
from plugins.common.types import SubmitResult, Workflow

from ..helpers import move_requires_roll
from ..types import PerformMoveContext, MoveRef


class DeclareInput(BaseModel):
    move_ids: list[str]
    stat_id: str = ""
    local_bonus: int = 0
    consume_bonus_ids: list[str] = Field(default_factory=list)
    resource_bonus_total: int | None = None
    cast_spell_entry_id: str = ""
    cast_spell_id: str = ""
    cast_spell_title: str = ""


class DeclarePatchInput(BaseModel):
    move_ids: list[str] | None = None
    move_id: str | None = None
    stat_id: str | None = None
    local_bonus: int | None = None
    consume_bonus_ids: list[str] | None = None
    resource_bonus_total: int | None = None
    cast_spell_entry_id: str | None = None
    cast_spell_id: str | None = None
    cast_spell_title: str | None = None


def empty_declare_draft() -> dict[str, Any]:
    return {
        "move_ids": [],
        "move_id": "",
        "stat_id": "",
        "local_bonus": 0,
        "consume_bonus_ids": [],
        "resource_bonus_total": 0,
        "cast_spell_entry_id": "",
        "cast_spell_id": "",
        "cast_spell_title": "",
    }


def merge_declare_draft(wf: Workflow, patch: dict[str, Any]) -> dict[str, Any]:
    cur = dict((wf.stageData or {}).get("draft") or empty_declare_draft())
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
    return cur


def union_stats_for_moves(move_ids: list[str], moves_map: dict) -> set[str]:
    stats: set[str] = set()
    for mid in move_ids:
        move = moves_map.get(mid)
        if move is None:
            continue
        for s in getattr(move, "available_stats", []) or []:
            stats.add(str(s))
    return stats


class PerformMoveDeclareStage(BaseStage):
    key = "perform_move.declare"

    def submit(self, wf: Workflow, ctx: StageCtx, input_dict: dict[str, Any]) -> SubmitResult:
        def err(field: str, msg: str) -> SubmitResult:
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue(field, msg)],
            )

        try:
            c = PerformMoveContext.model_validate(wf.context or {})
        except Exception as e:
            return err("context", str(e))

        if str(ctx.actor_user_id) not in (
            str(c.entry.actor_user_id),
            str(ctx.participants.gmUserId),
        ):
            return err("", "Only actor or GM can choose move")

        parsed = ctx.rb.parse_input(DeclareInput, input_dict, wf, ctx)
        if isinstance(parsed, SubmitResult):
            return parsed

        if not parsed.move_ids:
            return err("move_ids", "At least one move required")

        moves_map = {
            **self.full_codex.playbooks.playbook_moves_map(),
            **self.full_codex.moves.moves_map(),
        }

        # Валидируем и собираем все ходы
        resolved: list[MoveRef] = []
        for mid in parsed.move_ids:
            move = moves_map.get(mid)
            if move is None:
                return err("move_ids", f"Move not found: {mid}")
            resolved.append(MoveRef(
                id=move.id,
                title=move.title,
                kind=getattr(move, "kind", ""),
            ))

        c.entry.moves = resolved

        # Нужен ли бросок — хотя бы у одного хода есть available_stats
        available_stats: set[str] = set()
        for mid in parsed.move_ids:
            move = moves_map[mid]
            for s in getattr(move, "available_stats", []) or []:
                available_stats.add(s)

        roll_required = len(available_stats) > 0
        c.entry.roll.required = roll_required
        c.entry.roll.local_bonus = parsed.local_bonus
        c.entry.roll.temp_bonus_ids = list(parsed.consume_bonus_ids)

        if roll_required:
            if not parsed.stat_id:
                return err("stat_id", "stat_id required for this move set")
            if parsed.stat_id not in available_stats:
                return err("stat_id", f"Stat '{parsed.stat_id}' not available for selected moves")

            actor = next(
                (x for x in (ctx.scene.characters or [])
                 if str(x.id) == str(c.entry.actor_character_id)),
                None,
            )
            if actor is None:
                return err("actor", "Actor character not found")

            raw_data = actor.data if isinstance(actor.data, dict) else {}
            stat_modifiers = raw_data.get("stat_modifiers", {})
            base_mod = int(stat_modifiers.get(parsed.stat_id, 0))
            stats = raw_data.get("stats", {})
            stat_value = int(stats.get(parsed.stat_id, 0))

            c.entry.roll.stat_id = parsed.stat_id
            c.entry.roll.stat_value = stat_value
            c.entry.roll.base_modifier = base_mod
        else:
            c.entry.roll.stat_id = ""
            c.entry.roll.stat_value = 0
            c.entry.roll.base_modifier = 0

        wf.context = c.model_dump(mode="json")
        wf.stageKey = "perform_move.aid"

        return ctx.rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
        )

    def patch(self, wf: Workflow, ctx: StageCtx, input_dict: dict[str, Any]) -> SubmitResult:
        def err(field: str, msg: str) -> SubmitResult:
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue(field, msg)],
            )

        try:
            c = PerformMoveContext.model_validate(wf.context or {})
        except Exception as e:
            return err("context", str(e))

        if str(ctx.actor_user_id) not in (
            str(c.entry.actor_user_id),
            str(ctx.participants.gmUserId),
        ):
            return err("", "Only actor or GM can edit move draft")

        parsed = ctx.rb.parse_input(DeclarePatchInput, input_dict, wf, ctx)
        if isinstance(parsed, SubmitResult):
            return parsed

        moves_map = {
            **self.full_codex.playbooks.playbook_moves_map(),
            **self.full_codex.moves.moves_map(),
        }

        draft_patch: dict[str, Any] = {}
        if parsed.move_ids is not None:
            for mid in parsed.move_ids:
                if mid not in moves_map:
                    return err("move_ids", f"Move not found: {mid}")
            draft_patch["move_ids"] = list(parsed.move_ids)
            draft_patch["stat_id"] = ""
        if parsed.stat_id is not None:
            draft_patch["stat_id"] = parsed.stat_id
        if parsed.local_bonus is not None:
            draft_patch["local_bonus"] = parsed.local_bonus

        new_draft = merge_declare_draft(wf, draft_patch)
        move_ids = [str(x) for x in (new_draft.get("move_ids") or [])]
        available_stats = union_stats_for_moves(move_ids, moves_map)
        stat_id = str(new_draft.get("stat_id") or "")
        if stat_id and available_stats and stat_id not in available_stats:
            new_draft["stat_id"] = ""
        elif len(available_stats) == 1:
            new_draft["stat_id"] = next(iter(available_stats))

        wf.stageData = {**(wf.stageData or {}), "draft": new_draft}
        return ctx.rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
        )