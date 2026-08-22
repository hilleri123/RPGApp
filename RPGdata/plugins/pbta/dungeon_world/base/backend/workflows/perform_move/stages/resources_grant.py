from __future__ import annotations

import uuid
from typing import Any

from pydantic import BaseModel, Field

from plugins.common.protocols import StageCtx
from plugins.common.protocols.workflow_stage import StageOutcome, issue
from plugins.common.types import ActionParticipants, SubmitResult, Workflow

from ..engine import apply_resource_draft
from ..helpers import (
    collect_participating_factories,
    drop_ongoing_patch,
    merge_session_patch,
    moves_map_for_workflow,
    primary_move_id,
    spend_spell_entry,
)
from ..stage_store import DwStage
from ..types import ResourceDraft, ResourceGrant


class GrantItem(BaseModel):
    spec_id: str
    amount: int = 1
    target_kind: str = "character"
    target_id: str = ""
    filter_stats: list[str] = Field(default_factory=list)
    filter_moves: list[str] = Field(default_factory=list)
    filter_tags: list[str] = Field(default_factory=list)
    description: str = ""
    source_move_id: str = ""
    factory_id: str = ""


class ResourcesGrantInput(BaseModel):
    grants: list[GrantItem] = Field(default_factory=list)
    skip: bool = False
    cursor: int | None = None
    mark_done: bool = False
    drop_ongoing_ids: list[str] = Field(default_factory=list)
    spell_spend_entry_id: str = ""
    spell_spend_unprepare: bool = True


class ResourcesGrantPatchInput(BaseModel):
    grants: list[GrantItem] | None = None
    skip: bool | None = None
    cursor: int | None = None
    selected_factory_id: str | None = None
    drop_ongoing_ids: list[str] | None = None
    spell_spend_entry_id: str | None = None


def _grant_patch(ctx, grant: ResourceGrant) -> dict[str, list[dict]]:
    from plugins.pbta.base.backend.types import ResourceModifier

    draft = ResourceDraft(
        id=grant.id or str(uuid.uuid4()),
        move_id=grant.source_move_id or "grant",
        mod_index=0,
        spec_id=grant.spec_id,
        mod_kind="add",
        amount=grant.amount,
        target_kind=grant.target_kind,
        target_id=grant.target_id,
        description=grant.description,
        filter_stats=list(grant.filter_stats or []),
        filter_moves=list(grant.filter_moves or []),
        filter_tags=list(grant.filter_tags or []),
        confirmed=True,
        factory_id=grant.factory_id,
    )

    fake_move = type("MoveStub", (), {
        "id": grant.source_move_id or "grant",
        "resource_mods": [
            ResourceModifier(
                kind="add",
                spec_id=grant.spec_id,
                amount=grant.amount,
                target="self",
                filter_stats=list(grant.filter_stats or []),
                filter_moves=list(grant.filter_moves or []),
                filter_tags=list(grant.filter_tags or []),
                description=grant.description or "",
            )
        ],
    })()

    return apply_resource_draft(ctx, draft, {fake_move.id: fake_move})


class PerformMoveResourcesGrantStage(DwStage):
    """
    Выдача ресурсов затронутым сущностям.
    Мастер листает affected_entities (cursor) и копирует из фабрик хода/персонажей.
    """

    key = "perform_move.resources_grant"

    def _clear_entry_slice(self, entry: Any, wf: Workflow | None = None) -> None:
        entry.resource_grants = []
        entry.grant_cursor = 0

    def _attach_factories(self, wf: Workflow, ctx: StageCtx) -> None:
        try:
            c = self._context(wf)
        except Exception:
            return
        moves_map = moves_map_for_workflow(wf, self.full_codex, c=c, scene=ctx.scene)
        spells = []
        try:
            spells = list(self.full_codex.spells.get_spells())
        except Exception:
            spells = []
        factories = collect_participating_factories(
            c.entry,
            moves_map,
            ctx.scene,
            outcome=c.entry.roll.outcome,
            spells=spells,
        )
        wf.stageData = {
            **(wf.stageData or {}),
            "resourceFactories": factories,
            "grantTemplates": factories,
            "grantCursor": c.entry.grant_cursor,
            "affectedEntities": [e.model_dump(mode="json") for e in c.entry.affected_entities],
        }

    def validate_patch(self, wf: Workflow, ctx: StageCtx, raw: dict[str, Any]) -> StageOutcome:
        parsed = ctx.rb.parse_input(ResourcesGrantPatchInput, raw, wf, ctx)
        if isinstance(parsed, SubmitResult):
            return StageOutcome(ok=False, issues=parsed.issues)

        cur = dict(self.get(wf))
        if parsed.grants is not None:
            cur["grants"] = [g.model_dump(mode="json") for g in parsed.grants]
        if parsed.skip is not None:
            cur["skip"] = bool(parsed.skip)
        if parsed.cursor is not None:
            cur["cursor"] = int(parsed.cursor)
        if parsed.selected_factory_id is not None:
            cur["selected_factory_id"] = parsed.selected_factory_id
        return StageOutcome.ok_data(cur)

    def apply_patch(self, wf: Workflow, ctx: StageCtx, data: dict[str, Any]) -> None:
        self.put(wf, data)
        try:
            c = self._context(wf)
        except Exception:
            return
        if "cursor" in data:
            c.entry.grant_cursor = max(0, int(data.get("cursor") or 0))
            wf.context = c.model_dump(mode="json")
        self._attach_factories(wf, ctx)

    def validate_submit(self, wf: Workflow, ctx: StageCtx, raw: dict[str, Any]) -> StageOutcome:
        try:
            self._context(wf)
        except Exception as e:
            return StageOutcome.fail("context", str(e))

        parsed = ctx.rb.parse_input(ResourcesGrantInput, raw, wf, ctx)
        if isinstance(parsed, SubmitResult):
            return StageOutcome(ok=False, issues=parsed.issues)

        return StageOutcome.ok_data({
            "grants": [g.model_dump(mode="json") for g in parsed.grants],
            "skip": bool(parsed.skip),
            "cursor": parsed.cursor,
            "mark_done": bool(parsed.mark_done),
            "drop_ongoing_ids": list(parsed.drop_ongoing_ids or []),
            "spell_spend_entry_id": str(parsed.spell_spend_entry_id or ""),
            "spell_spend_unprepare": bool(parsed.spell_spend_unprepare),
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

        try:
            c = self._context(wf)
        except Exception as e:
            return err("context", str(e))

        validation = self.validate_submit(wf, ctx, data)
        if not validation.ok:
            return ctx.rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=validation.issues,
            )

        self.put(wf, validation.data)
        patch: dict[str, list[dict]] = {}
        move_id = primary_move_id(c.entry)

        if not validation.data.get("skip"):
            for g in validation.data.get("grants") or []:
                target_kind = g.get("target_kind") or "character"
                target_id = str(g.get("target_id") or "")
                if not target_id and c.entry.affected_entities:
                    cursor = int(validation.data.get("cursor") if validation.data.get("cursor") is not None else c.entry.grant_cursor)
                    if 0 <= cursor < len(c.entry.affected_entities):
                        ae = c.entry.affected_entities[cursor]
                        target_kind = ae.kind
                        target_id = ae.id
                if not target_id:
                    if target_kind == "character" and c.entry.actor_character_id:
                        target_id = str(c.entry.actor_character_id)
                    elif target_kind == "npc" and c.entry.actor_npc_id:
                        target_id = str(c.entry.actor_npc_id)

                filter_moves = list(g.get("filter_moves") or [])
                if not filter_moves and move_id:
                    filter_moves = [move_id]

                grant = ResourceGrant(
                    id=str(uuid.uuid4()),
                    spec_id=str(g.get("spec_id") or ""),
                    amount=int(g.get("amount") or 1),
                    target_kind=target_kind,  # type: ignore[arg-type]
                    target_id=target_id,
                    filter_stats=list(g.get("filter_stats") or []),
                    filter_moves=filter_moves,
                    filter_tags=list(g.get("filter_tags") or []),
                    description=str(g.get("description") or ""),
                    source_move_id=str(g.get("source_move_id") or move_id),
                    factory_id=str(g.get("factory_id") or ""),
                )
                c.entry.resource_grants.append(grant)
                grant_patch = _grant_patch(ctx, grant)
                for key, items in grant_patch.items():
                    patch.setdefault(key, []).extend(items)

        # Drop ongoing / spend spell on actor character
        actor_cid = str(c.entry.actor_character_id or "") if c.entry.actor_kind == "character" else ""
        drop_ids = list(validation.data.get("drop_ongoing_ids") or [])
        spell_spend_id = str(validation.data.get("spell_spend_entry_id") or "")
        if actor_cid and (drop_ids or spell_spend_id):
            ch = next((x for x in (ctx.scene.characters or []) if str(x.id) == actor_cid), None)
            if ch and isinstance(ch.data, dict):
                updated = dict(ch.data)
                if drop_ids:
                    updated = drop_ongoing_patch(updated, drop_ids)
                if spell_spend_id:
                    updated = spend_spell_entry(
                        updated,
                        spell_spend_id,
                        unprepare=bool(validation.data.get("spell_spend_unprepare", True)),
                    )
                patch.setdefault("characters", []).append({"id": actor_cid, "dataPatch": updated})

        if validation.data.get("cursor") is not None:
            c.entry.grant_cursor = int(validation.data["cursor"])
        if validation.data.get("mark_done") and c.entry.affected_entities:
            idx = c.entry.grant_cursor
            if 0 <= idx < len(c.entry.affected_entities):
                c.entry.affected_entities[idx].done = True
                if idx + 1 < len(c.entry.affected_entities):
                    c.entry.grant_cursor = idx + 1

        wf.context = c.model_dump(mode="json")
        merged = merge_session_patch(wf, patch or None)
        self._attach_factories(wf, ctx)

        return ctx.rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
            sessionPatch=merged,
        )

    def visibility(self, wf: Workflow, ctx: StageCtx, participants: ActionParticipants) -> list[str]:
        return self._gm_actor_helper_visibility(wf, ctx, participants, gm_only=True)
