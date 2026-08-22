from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from plugins.common.protocols import StageCtx
from plugins.common.protocols.workflow_stage import StageOutcome, issue
from plugins.common.types import ActionParticipants, SubmitResult, Workflow

from ..engine import _roll_damage_expr, roll_damage_claim
from ..stage_store import DwStage
from ..types import DieAllocation


class DamageRollInput(BaseModel):
    rolls: list[dict[str, Any]] = Field(default_factory=list)
    skip: bool = False


def _merge_rolls_by_id(
    current: dict[str, Any],
    incoming: dict[str, Any],
    *,
    allowed_claim_ids: set[str] | None,
) -> dict[str, Any]:
    """Merge rollsById by claim id. If allowed_claim_ids is set, only those keys are updated."""
    merged = {str(k): (dict(v) if isinstance(v, dict) else v) for k, v in (current or {}).items()}
    for claim_id, roll in (incoming or {}).items():
        cid = str(claim_id)
        if allowed_claim_ids is not None and cid not in allowed_claim_ids:
            continue
        if isinstance(roll, dict):
            merged[cid] = dict(roll)
        else:
            merged[cid] = roll
    return merged


def _roller_claim_ids(c, user_id: str) -> set[str]:
    uid = str(user_id)
    return {
        str(cl.id)
        for cl in (c.entry.damage_claims or [])
        if cl.roller_user_id and str(cl.roller_user_id) == uid
    }


def _claim_by_id(c, claim_id: str):
    for cl in c.entry.damage_claims or []:
        if str(cl.id) == str(claim_id):
            return cl
    return None


def _default_allocations_for_claim(claim, dice: list[int]) -> list[dict[str, Any]]:
    target_kind = claim.target_kind or "npc"
    target_id = str(claim.target_character_id or claim.target_npc_id or "")
    if not target_id:
        return []
    return [
        {
            "die_index": i,
            "value": int(v),
            "target_kind": target_kind,
            "target_id": target_id,
        }
        for i, v in enumerate(dice)
    ]


def _sanitize_roll_patch(
    *,
    claim_id: str,
    incoming: dict[str, Any],
    existing: dict[str, Any] | None,
    claim,
) -> dict[str, Any]:
    item = dict(incoming)
    prev = existing if isinstance(existing, dict) else {}

    if not item.get("committed"):
        item["dice"] = []
        item["allocations"] = []
        item["flatBonus"] = 0
        item["flat_bonus"] = 0
        item["total_raw"] = 0
        item["committed"] = False
        return item

    # Once committed, seed+dice are frozen; only allocations may change.
    if prev.get("committed") and prev.get("dice"):
        dice = [int(x) for x in (prev.get("dice") or [])]
        flat = int(prev.get("flatBonus") or prev.get("flat_bonus") or 0)
        item["roll_seed"] = str(prev.get("roll_seed") or item.get("roll_seed") or "")
        item["dice"] = dice
        item["flatBonus"] = flat
        item["flat_bonus"] = flat
        item["total_raw"] = int(prev.get("total_raw") or (sum(dice) + flat))
        item["committed"] = True
        item["allocations"] = _remap_allocation_values(item.get("allocations") or [], dice)
        return item

    seed = str(item.get("roll_seed") or prev.get("roll_seed") or "")
    if not seed or claim is None or not claim.formula:
        item["committed"] = False
        item["dice"] = []
        item["allocations"] = []
        return item

    total, dice, flat = _roll_damage_expr(str(claim.formula), seed)
    item["roll_seed"] = seed
    item["dice"] = list(dice)
    item["flatBonus"] = int(flat)
    item["flat_bonus"] = int(flat)
    item["total_raw"] = int(total)
    item["committed"] = True
    raw_alloc = item.get("allocations") or []
    if raw_alloc:
        item["allocations"] = _remap_allocation_values(raw_alloc, dice)
    else:
        item["allocations"] = _default_allocations_for_claim(claim, dice)
    return item


def _remap_allocation_values(raw: list[Any], dice: list[int]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        die_index = int(item.get("die_index") or 0)
        if die_index < 0 or die_index >= len(dice):
            continue
        target_kind = str(item.get("target_kind") or "")
        target_id = str(item.get("target_id") or "")
        if not target_id:
            continue
        out.append({
            "die_index": die_index,
            "value": int(dice[die_index]),
            "target_kind": target_kind,
            "target_id": target_id,
        })
    return out


class PerformMoveDamageRollStage(DwStage):
    key = "perform_move.damage_roll"

    def _clear_entry_slice(self, entry: Any, wf: Workflow | None = None) -> None:
        for claim in entry.damage_claims or []:
            claim.roll_seed = ""
            claim.dice = []
            claim.dice_allocations = []
            claim.flat_bonus = 0
            claim.total_raw = 0
            claim.rolled = False

    def validate_patch(self, wf: Workflow, ctx: StageCtx, raw: dict[str, Any]) -> StageOutcome:
        cur = dict(self.get(wf))
        rolls_by_id = raw.get("rollsById")
        if rolls_by_id is None:
            rolls_by_id = raw.get("rolls_by_id")
        if rolls_by_id is None:
            return StageOutcome.ok_data(cur)
        if not isinstance(rolls_by_id, dict):
            return StageOutcome.fail("rollsById", "rollsById must be an object")

        try:
            c = self._context(wf)
        except Exception as e:
            return StageOutcome.fail("context", str(e))

        uid = str(ctx.actor_user_id)
        is_owner = self._actor_or_gm(ctx, c)
        allowed = None if is_owner else _roller_claim_ids(c, uid)
        if allowed is not None and not allowed:
            return StageOutcome.fail("", "Нет заявок, назначенных вам для броска")

        existing = cur.get("rollsById") if isinstance(cur.get("rollsById"), dict) else {}
        sanitized: dict[str, Any] = {}
        for cid, roll in (rolls_by_id or {}).items():
            key = str(cid)
            if not isinstance(roll, dict):
                sanitized[key] = roll
                continue
            prev = existing.get(key) if isinstance(existing.get(key), dict) else {}
            sanitized[key] = _sanitize_roll_patch(
                claim_id=key,
                incoming=roll,
                existing=prev,
                claim=_claim_by_id(c, key),
            )
        cur["rollsById"] = _merge_rolls_by_id(existing, sanitized, allowed_claim_ids=allowed)
        return StageOutcome.ok_data(cur)

    def apply_patch(self, wf: Workflow, ctx: StageCtx, data: dict[str, Any]) -> None:
        self.put(wf, data)

    def validate_submit(self, wf: Workflow, ctx: StageCtx, raw: dict[str, Any]) -> StageOutcome:
        parsed = ctx.rb.parse_input(DamageRollInput, raw, wf, ctx)
        if isinstance(parsed, SubmitResult):
            return StageOutcome(ok=False, issues=parsed.issues)
        return StageOutcome.ok_data({
            "rolls": list(parsed.rolls or []),
            "skip": bool(parsed.skip),
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

        if not self._actor_or_gm(ctx, c):
            return err("", "Только мастер или исполнитель хода может завершить броски HP")

        if data.get("skip"):
            self.put(wf, {"rollsById": {}, "skip": True})
            wf.context = c.model_dump(mode="json")
            return ctx.rb.result(
                ok=True,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[],
            )

        # Prefer live patched rollsById, then submit payload
        staged = self.get(wf).get("rollsById") if isinstance(self.get(wf).get("rollsById"), dict) else {}
        by_id = {str(k): v for k, v in staged.items()}
        for r in data.get("rolls") or []:
            if isinstance(r, dict) and r.get("id"):
                by_id[str(r["id"])] = r

        for claim in c.entry.damage_claims:
            incoming = by_id.get(claim.id)
            if incoming:
                seed = str(incoming.get("roll_seed") or claim.roll_seed or "")
                if not seed:
                    return err(claim.id, "Нужен roll_seed для броска HP")
                # Never trust client dice/totals — recompute from seed.
                claim.roll_seed = seed
                claim.rolled = False
                claim.total_raw = 0
                claim.dice = []
                claim.flat_bonus = 0
                roll_damage_claim(claim, ctx.scene, seed=seed)
                claim.dice_allocations = _parse_allocations(
                    incoming.get("allocations") or [],
                    claim,
                    expected_dice=claim.dice,
                )
            elif claim.roll_seed and claim.formula and not claim.rolled:
                roll_damage_claim(claim, ctx.scene, seed=claim.roll_seed)

        self.put(wf, {"rollsById": by_id, "skip": False})
        wf.context = c.model_dump(mode="json")

        from app.services.roll_persist import store_seed_image

        log_events = []
        for claim in c.entry.damage_claims:
            if not claim.rolled or claim.cancelled:
                continue
            seed_hash, _ = store_seed_image(claim.roll_seed or None)
            log_events.append(
                ctx.rb.log_roll(
                    title=f"{claim.source_label} → {claim.target_label} · {claim.formula}",
                    dice=list(claim.dice or []),
                    total=int(claim.total_raw or 0),
                    outcome="heal" if claim.hp_effect == "heal" else "damage",
                    seed=claim.roll_seed or None,
                    roll_kind="damage",
                    meta={
                        "expression": claim.formula,
                        "system_id": "pbta.dungeon_world",
                        "claim_id": claim.id,
                        "total_final": claim.total_final,
                        "seed_hash": seed_hash,
                    },
                )
            )

        return ctx.rb.result(
            ok=True,
            wf=wf,
            participants=ctx.participants,
            participants_dict_fallback=ctx.participants_dict,
            issues=[],
            logEvents=log_events,
        )

    def visibility(self, wf: Workflow, ctx: StageCtx, participants: ActionParticipants) -> list[str]:
        return self._gm_actor_helper_visibility(wf, ctx, participants, include_rollers=True)


def _parse_allocations(
    raw: list[Any],
    claim,
    *,
    expected_dice: list[int] | None = None,
) -> list[DieAllocation]:
    out: list[DieAllocation] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        target_kind = str(item.get("target_kind") or claim.target_kind)
        target_id = str(item.get("target_id") or "")
        if not target_id:
            continue
        die_index = int(item.get("die_index") or 0)
        if expected_dice is not None:
            if die_index < 0 or die_index >= len(expected_dice):
                continue
            value = int(expected_dice[die_index])
        else:
            value = int(item.get("value") or 0)
        out.append(DieAllocation(
            die_index=die_index,
            value=value,
            target_kind=target_kind,  # type: ignore[arg-type]
            target_character_id=target_id if target_kind == "character" else None,
            target_npc_id=target_id if target_kind == "npc" else None,
        ))
    return out
