from __future__ import annotations

import uuid
from typing import Any

from plugins.common.types import Workflow

from .helpers import attacks_to_damage_claims, primary_move_id
from .stage_store import get_stage_data, set_stage_data
from .types import AffectedEntity, PerformMoveContext, ResourceGrant
from .types_change_manifest import ChangeManifestState, ManifestLine, ManifestTarget


STAGE_KEY = "perform_move.change_manifest"


def read_manifest(wf: Workflow) -> ChangeManifestState:
    raw = get_stage_data(wf, STAGE_KEY)
    if not raw:
        return ChangeManifestState()
    return ChangeManifestState.model_validate(raw)


def write_manifest(wf: Workflow, state: ChangeManifestState) -> None:
    set_stage_data(wf, STAGE_KEY, state.model_dump(mode="json"))


def prefill_manifest_from_entry(wf: Workflow, c: PerformMoveContext) -> ChangeManifestState:
    existing = read_manifest(wf)
    if existing.lines:
        return existing

    lines: list[ManifestLine] = []
    for draft in c.entry.resolve.resource_drafts or []:
        tk = str(draft.target_kind or "none")
        tid = str(draft.target_id or "")
        target_kind = tk if tk in ("character", "npc", "world", "none") else "none"
        lines.append(
            ManifestLine(
                id=str(draft.id or uuid.uuid4()),
                kind="resource_draft",
                target=ManifestTarget(kind=target_kind, id=tid, name=""),  # type: ignore[arg-type]
                payload={
                    "draft_id": str(draft.id),
                    "move_id": draft.move_id,
                    "move_title": draft.move_title,
                    "spec_id": draft.spec_id,
                    "amount": draft.amount,
                    "target_kind": draft.target_kind,
                    "target_id": draft.target_id,
                    "description": draft.description,
                    "skipped": bool(draft.skipped),
                    "confirmed": bool(draft.confirmed),
                },
                status="skipped" if draft.skipped else "draft",
                label=f"{draft.spec_id} ×{draft.amount}" if draft.spec_id else "Ресурс",
            )
        )

    state = ChangeManifestState(mode="edit", lines=lines)
    write_manifest(wf, state)
    return state


def sync_manifest_lines_to_entry(wf: Workflow, c: PerformMoveContext, scene, *, mode: str) -> None:
    state = read_manifest(wf)
    attacks: list[dict[str, Any]] = []
    grants: list[ResourceGrant] = []
    affected: dict[str, AffectedEntity] = {}

    move_id = primary_move_id(c.entry)

    for line in state.lines:
        if line.status == "skipped":
            continue
        if line.kind == "resource_draft":
            draft_id = str(line.payload.get("draft_id") or line.id)
            for draft in c.entry.resolve.resource_drafts:
                if str(draft.id) != draft_id:
                    continue
                draft.skipped = bool(line.payload.get("skipped"))
                draft.confirmed = not draft.skipped and bool(line.payload.get("confirmed", True))
                draft.amount = int(line.payload.get("amount") or draft.amount)
                draft.target_kind = line.payload.get("target_kind") or draft.target_kind
                draft.target_id = str(line.payload.get("target_id") or draft.target_id or "")
                draft.description = str(line.payload.get("description") or draft.description or "")
            continue

        if line.kind == "damage":
            if line.status == "skipped":
                continue
            p = dict(line.payload)
            p.setdefault("id", line.id)
            if line.target.id:
                p.setdefault("target_kind", line.target.kind)
                p.setdefault("target_id", line.target.id)
            attacks.append(p)
            tk = line.target.kind
            tid = line.target.id
            if tk in ("character", "npc") and tid:
                affected[f"{tk}:{tid}"] = AffectedEntity(kind=tk, id=tid, name=line.target.name)
            continue

        if line.kind == "resource_grant":
            if line.status == "skipped":
                continue
            p = line.payload
            tk = str(p.get("target_kind") or line.target.kind or "character")
            tid = str(p.get("target_id") or line.target.id or "")
            if tk in ("character", "npc") and tid:
                affected[f"{tk}:{tid}"] = AffectedEntity(
                    kind=tk,  # type: ignore[arg-type]
                    id=tid,
                    name=line.target.name,
                )
            grants.append(
                ResourceGrant(
                    id=line.id,
                    spec_id=str(p.get("spec_id") or ""),
                    amount=int(p.get("amount") or 1),
                    target_kind=tk,  # type: ignore[arg-type]
                    target_id=tid,
                    filter_stats=list(p.get("filter_stats") or []),
                    filter_moves=list(p.get("filter_moves") or []),
                    filter_tags=list(p.get("filter_tags") or []),
                    description=str(p.get("description") or ""),
                    source_move_id=str(p.get("source_move_id") or move_id),
                    factory_id=str(p.get("factory_id") or ""),
                )
            )

    existing_by_id = {str(cl.id): cl for cl in (c.entry.damage_claims or [])}
    rebuilt = attacks_to_damage_claims(attacks, scene=scene, source_move_id=move_id)
    merged_claims = []
    for claim in rebuilt:
        prev = existing_by_id.get(str(claim.id))
        # Prefer live damage_roll results already on entry when payload didn't carry them.
        if prev is not None and prev.rolled and not claim.rolled:
            claim.roll_seed = prev.roll_seed or claim.roll_seed
            claim.dice = list(prev.dice or [])
            claim.dice_allocations = list(prev.dice_allocations or [])
            claim.flat_bonus = int(prev.flat_bonus or 0)
            claim.total_raw = int(prev.total_raw or 0)
            claim.armor_applied = int(prev.armor_applied or 0)
            claim.total_final = int(prev.total_final or 0)
            claim.rolled = True
            claim.applied = bool(prev.applied)
            claim.cancelled = bool(prev.cancelled)
            claim.cancel_reason = prev.cancel_reason or ""
        elif prev is not None and prev.rolled and claim.rolled:
            # Payload has totals; keep allocations/seed from entry if missing.
            if not claim.dice_allocations and prev.dice_allocations:
                claim.dice_allocations = list(prev.dice_allocations)
            if (not claim.roll_seed or len(claim.roll_seed) < 64) and prev.roll_seed:
                claim.roll_seed = prev.roll_seed
            if not claim.dice and prev.dice:
                claim.dice = list(prev.dice)
        merged_claims.append(claim)

    c.entry.damage_claims = merged_claims
    c.entry.resource_grants = grants
    c.entry.affected_entities = list(affected.values())
    c.entry.grant_cursor = 0

    wf.context = c.model_dump(mode="json")


def sync_claims_to_manifest_lines(wf: Workflow, c: PerformMoveContext) -> None:
    state = read_manifest(wf)
    by_id = {line.id: line for line in state.lines if line.kind == "damage"}
    for claim in c.entry.damage_claims or []:
        line = by_id.get(claim.id)
        if not line:
            continue
        if claim.cancelled:
            line.status = "skipped"
        elif claim.rolled:
            line.status = "rolled"
            line.payload = {
                **line.payload,
                "roll_seed": claim.roll_seed,
                "total_final": claim.total_final,
                "total_raw": claim.total_raw,
                "armor_applied": claim.armor_applied,
                "flat_bonus": claim.flat_bonus,
                "dice": list(claim.dice or []),
                "allocations": [
                    {
                        "die_index": a.die_index,
                        "value": a.value,
                        "target_kind": a.target_kind,
                        "target_id": a.target_character_id or a.target_npc_id,
                    }
                    for a in (claim.dice_allocations or [])
                ],
                "rolled": True,
            }
        elif claim.needs_roll:
            line.status = "needs_roll"
    write_manifest(wf, state)


def claims_need_roll(c: PerformMoveContext) -> bool:
    return any(
        cl.needs_roll and not cl.rolled and not cl.cancelled
        for cl in (c.entry.damage_claims or [])
    )
