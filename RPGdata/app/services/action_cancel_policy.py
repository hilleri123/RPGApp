"""Policy for who may cancel a scene action."""

from __future__ import annotations

from typing import Any


def action_progress_locks_initiator(action: Any) -> bool:
    """True once dice were committed or session effects applied — initiator may no longer cancel."""
    status = getattr(action, "status", None)
    if status in ("completed", "canceled"):
        return True

    session_patch = getattr(action, "sessionPatch", None)
    if session_patch:
        return True

    wf = getattr(action, "workflow", None)
    wf = wf if isinstance(wf, dict) else {}
    ctx = wf.get("context") if isinstance(wf.get("context"), dict) else {}
    entry = ctx.get("entry") if isinstance(ctx.get("entry"), dict) else {}

    roll = entry.get("roll") if isinstance(entry.get("roll"), dict) else {}
    dice = roll.get("dice")
    has_dice = isinstance(dice, list) and len(dice) > 0
    total = roll.get("total")
    # Fresh perform_move defaults: dice=[], total=0 — must not lock.
    if has_dice or (isinstance(total, (int, float)) and total != 0) or roll.get("outcome"):
        return True
    if roll.get("roll_seed") and (roll.get("result_text") or has_dice):
        return True

    for claim in entry.get("damage_claims") or []:
        if isinstance(claim, dict) and claim.get("rolled"):
            return True

    sd = wf.get("stageData") if isinstance(wf.get("stageData"), dict) else {}
    for value in sd.values():
        if not isinstance(value, dict):
            continue
        stage_dice = value.get("dice")
        if isinstance(stage_dice, list) and len(stage_dice) > 0 and value.get("roll_seed"):
            return True

    return False


def user_may_cancel_action(
    *,
    user_id: Any,
    master_id: Any | None,
    action: Any,
) -> bool:
    """Return whether user_id is allowed to cancel this action."""
    if master_id is not None and str(master_id) == str(user_id):
        return True

    participants = getattr(action, "participants", None)
    initiator_id = getattr(participants, "initiatorUserId", None) if participants is not None else None
    if initiator_id is None or str(initiator_id) != str(user_id):
        return False
    return not action_progress_locks_initiator(action)
