"""Wizard metadata for base perform_move UI navigation."""

from __future__ import annotations

from plugins.common.types import Workflow

from .types import PerformMoveContext

STAGE_LABELS: dict[str, str] = {
    "perform_move.setup": "Настройка",
    "perform_move.declare": "Ход",
    "perform_move.aid": "Помощь",
    "perform_move.roll": "Бросок",
    "perform_move.resolve": "Разбор",
    "perform_move.choose": "Выбор",
    "perform_move.apply": "Применение",
    "perform_move.result": "Итог",
}

STAGE_ORDER: list[str] = [
    "perform_move.setup",
    "perform_move.declare",
    "perform_move.aid",
    "perform_move.roll",
    "perform_move.resolve",
    "perform_move.choose",
    "perform_move.apply",
    "perform_move.result",
]

SERVER_AUTO_STAGES: set[str] = {
    "perform_move.resolve",
    "perform_move.apply",
}

ROLL_FREEZE_THROUGH = "perform_move.roll"


def _order_index(key: str) -> int:
    try:
        return STAGE_ORDER.index(key)
    except ValueError:
        return 999


def _furthest_key(wf: Workflow) -> str:
    wizard = (wf.stageData or {}).get("wizard") or {}
    furthest = str(wizard.get("furthestKey") or "")
    current = str(wf.stageKey or "")
    if furthest and _order_index(furthest) >= _order_index(current):
        return furthest
    return current or STAGE_ORDER[0]


def _progress_index(wf: Workflow) -> int:
    return _order_index(_furthest_key(wf))


def mark_stage_visited(wf: Workflow, stage_key: str) -> None:
    sd = dict(wf.stageData or {})
    wizard = dict(sd.get("wizard") or {})
    cur = str(wizard.get("furthestKey") or "")
    if _order_index(stage_key) >= _order_index(cur):
        wizard["furthestKey"] = stage_key
    visited = list(wizard.get("visited") or [])
    if stage_key and stage_key not in visited:
        visited.append(stage_key)
    wizard["visited"] = visited
    sd["wizard"] = wizard
    wf.stageData = sd


def _roll_frozen(c: PerformMoveContext) -> bool:
    return len(c.entry.roll.dice or []) >= 2


def attach_wizard_state(wf: Workflow, c: PerformMoveContext) -> None:
    wizard = dict((wf.stageData or {}).get("wizard") or {})
    current = wf.stageKey or ""
    furthest = _furthest_key(wf)
    roll_frozen = _roll_frozen(c)
    progress = _progress_index(wf)
    freeze_idx = _order_index(ROLL_FREEZE_THROUGH)

    steps: list[dict] = []
    for key in STAGE_ORDER:
        idx = _order_index(key)
        pending = idx > progress
        frozen = roll_frozen and idx <= freeze_idx
        readonly = pending or frozen or key in SERVER_AUTO_STAGES
        disabled = pending
        editable = not readonly and key not in SERVER_AUTO_STAGES
        if key == current:
            status = "current"
        elif pending:
            status = "pending"
        else:
            status = "done"
        steps.append({
            "key": key,
            "label": STAGE_LABELS.get(key, key),
            "status": status,
            "readonly": readonly,
            "disabled": disabled,
            "frozen": frozen,
            "editable": editable,
        })

    wizard.update({
        "steps": steps,
        "currentKey": current,
        "furthestKey": furthest,
        "frozenThrough": ROLL_FREEZE_THROUGH if roll_frozen else None,
        "rollFrozen": roll_frozen,
    })
    wf.stageData = {**(wf.stageData or {}), "wizard": wizard}


def is_stage_readonly(wf: Workflow, c: PerformMoveContext, stage_key: str) -> bool:
    if _order_index(stage_key) > _progress_index(wf):
        return True
    if _roll_frozen(c) and _order_index(stage_key) <= _order_index(ROLL_FREEZE_THROUGH):
        return True
    if stage_key in SERVER_AUTO_STAGES:
        return True
    if stage_key == ROLL_FREEZE_THROUGH and _roll_frozen(c):
        return True
    return False
