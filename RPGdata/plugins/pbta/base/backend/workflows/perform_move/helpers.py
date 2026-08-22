from __future__ import annotations

from typing import Any

from plugins.common.dice import roll_2d6 as _roll_2d6


def uniq(xs: list[str | None]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for x in xs:
        if not x:
            continue
        if x in seen:
            continue
        seen.add(x)
        out.append(x)
    return out


def roll_2d6(seed: str) -> tuple[list[int], int]:
    return _roll_2d6(seed)


def build_roll_stage_data(c: Any) -> dict[str, Any]:
    roll = c.entry.roll
    modifiers: list[dict[str, Any]] = []
    if roll.stat_id:
        modifiers.append({
            "id": "stat",
            "label": f"{roll.stat_id.upper()} ({roll.stat_value})",
            "value": int(roll.base_modifier or 0),
        })
    if roll.local_bonus:
        modifiers.append({
            "id": "local",
            "label": "Местный бонус",
            "value": int(roll.local_bonus),
        })
    if roll.aid_bonus:
        modifiers.append({
            "id": "aid",
            "label": "Помощь",
            "value": int(roll.aid_bonus),
        })
    return {
        "rollSpec": {
            "expression": "2d6",
            "modifiers": modifiers,
            "interpreter": "pbta_2d6",
            "layout": "combined",
        }
    }


def attach_roll_stage_data(wf: Any, c: Any) -> None:
    # Merge — do not wipe moves/wizard/etc. that setup & declare already put in stageData.
    wf.stageData = {**(wf.stageData or {}), **build_roll_stage_data(c)}


def move_requires_roll(move: Any) -> bool:
    if hasattr(move, "requires_roll"):
        try:
            return bool(getattr(move, "requires_roll"))
        except Exception:
            pass

    available_stats = getattr(move, "available_stats", None) or []
    return len(available_stats) > 0


def outcome_from_total(total: int) -> str:
    if total >= 10:
        return "hit_10_plus"
    if total >= 7:
        return "hit_7_9"
    return "miss_6_minus"