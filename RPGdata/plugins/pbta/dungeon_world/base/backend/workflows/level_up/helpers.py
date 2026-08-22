from __future__ import annotations

from copy import deepcopy
from typing import Any

from plugins.pbta.base.backend.types import CustomMove


def xp_cost_for_level(level: int) -> int:
    """Dungeon World: spend XP equal to (current level + 7) to advance."""
    return max(1, int(level or 1)) + 7


def can_level_up(data: dict[str, Any] | None) -> bool:
    d = data if isinstance(data, dict) else {}
    level = int(d.get("level") or 1)
    xp = int(d.get("xp") or 0)
    return xp >= xp_cost_for_level(level)


def _playbook(codex: Any, playbook_id: str):
    if not playbook_id:
        return None
    try:
        return (codex.playbooks.playbooks_map() or {}).get(playbook_id)
    except Exception:
        return None


def _playbook_id(data: dict[str, Any]) -> str:
    return str(data.get("playbook_id") or data.get("playbook") or "")


def _codex_moves_map(codex: Any) -> dict[str, Any]:
    out: dict[str, Any] = {}
    try:
        out.update(codex.playbooks.moves_map() or {})
    except Exception:
        pass
    try:
        out.update(codex.moves.moves_map() or {})
    except Exception:
        pass
    return out


def _move_tier(codex: Any, data: dict[str, Any], move_id: str) -> str:
    """Return '2+' / '6+' / '' based on playbook lists."""
    pb = _playbook(codex, _playbook_id(data))
    if not pb:
        return ""
    mid = str(move_id)
    if mid in {str(x) for x in (getattr(pb, "advanced_moves_6_10", None) or [])}:
        return "6+"
    if mid in {str(x) for x in (getattr(pb, "advanced_moves", None) or [])}:
        return "2+"
    return ""


def eligible_advanced_move_ids(codex: Any, data: dict[str, Any]) -> list[str]:
    """Moves available to take when advancing to next level."""
    d = data if isinstance(data, dict) else {}
    pb = _playbook(codex, _playbook_id(d))
    if not pb:
        return []

    current_level = int(d.get("level") or 1)
    next_level = current_level + 1
    owned = {str(m) for m in (d.get("moves") or []) if m}

    pool: list[str] = []
    # Levels 2–5 unlock advanced_moves; from 6 also unlock 6–10 list.
    if next_level >= 2:
        for mid in getattr(pb, "advanced_moves", None) or []:
            if str(mid) not in owned:
                pool.append(str(mid))
    if next_level >= 6:
        for mid in getattr(pb, "advanced_moves_6_10", None) or []:
            if str(mid) not in owned and str(mid) not in pool:
                pool.append(str(mid))
    return pool


def move_options(codex: Any, data: dict[str, Any]) -> list[dict[str, Any]]:
    """Full Move dumps (as in perform_move) + tier badge for level-up picker."""
    ids = eligible_advanced_move_ids(codex, data)
    moves_map = _codex_moves_map(codex)
    titles = {str(getattr(m, "id", "") or ""): str(getattr(m, "title", None) or "") for m in moves_map.values()}
    out: list[dict[str, Any]] = []
    for mid in ids:
        m = moves_map.get(mid)
        tier = _move_tier(codex, data, mid)
        tier_badge = f"ур. {tier}" if tier else ""
        if m is not None and hasattr(m, "model_dump"):
            raw = m.model_dump(mode="json")
        else:
            raw = {"id": mid, "title": mid, "kind": "class", "summary": ""}
        # Human-readable prerequisites for UI
        cond = raw.get("condition") if isinstance(raw.get("condition"), dict) else {}
        req_moves = [str(x) for x in (cond.get("requires_moves") or []) if x]
        req_labels = [titles.get(rid) or rid for rid in req_moves]
        out.append({
            **raw,
            "id": mid,
            "title": str(raw.get("title") or mid),
            "tier": tier,
            "tier_badge": tier_badge,
            "requires_move_ids": req_moves,
            "requires_move_titles": req_labels,
        })
    return out


def skill_options(codex: Any) -> list[dict[str, Any]]:
    skills = []
    try:
        skills = list(codex.skills.get_skills() or [])
    except Exception:
        skills = []
    out: list[dict[str, Any]] = []
    for sk in skills:
        sid = str(getattr(sk, "id", "") or "")
        if not sid:
            continue
        out.append({
            "id": sid,
            "title": str(getattr(sk, "title", None) or sid),
            "color": str(getattr(sk, "color", None) or ""),
        })
    return out


def stat_options(codex: Any, data: dict[str, Any]) -> list[dict[str, Any]]:
    d = data if isinstance(data, dict) else {}
    stats = d.get("stats") if isinstance(d.get("stats"), dict) else {}
    out: list[dict[str, Any]] = []
    for sk in skill_options(codex):
        sid = sk["id"]
        cur = int(stats.get(sid) or 0)
        out.append({
            "id": sid,
            "title": sk["title"],
            "value": cur,
            "can_increase": cur < 18,
            "color": sk.get("color") or "",
        })
    return out


def _attach_custom_move(updated: dict[str, Any], custom_raw: dict[str, Any]) -> str:
    cm = CustomMove.model_validate(custom_raw)
    customs = [c for c in (updated.get("custom_moves") or []) if isinstance(c, dict)]
    customs = [c for c in customs if str(c.get("id")) != cm.id]
    customs.append(cm.model_dump(mode="json"))
    updated["custom_moves"] = customs
    return cm.id


def apply_level_up(
    codex: Any,
    data: dict[str, Any],
    *,
    stat_id: str,
    move_id: str,
    custom_move: dict[str, Any] | None = None,
    allow_custom: bool = False,
) -> dict[str, Any]:
    """Return a full character data dict after level-up (does not mutate input)."""
    updated = deepcopy(data if isinstance(data, dict) else {})
    level = int(updated.get("level") or 1)
    xp = int(updated.get("xp") or 0)
    cost = xp_cost_for_level(level)

    if xp < cost:
        raise ValueError(f"Not enough XP: have {xp}, need {cost}")

    stats = dict(updated.get("stats") or {})
    if stat_id not in stats:
        raise ValueError(f"Unknown stat: {stat_id}")
    if int(stats[stat_id]) >= 18:
        raise ValueError(f"Stat {stat_id} is already at maximum")

    granted_id = str(move_id or "")
    if custom_move and allow_custom:
        granted_id = _attach_custom_move(updated, custom_move)
    else:
        allowed = set(eligible_advanced_move_ids(codex, updated))
        if granted_id not in allowed:
            raise ValueError(f"Move {granted_id} is not available for this level-up")

    if not granted_id:
        raise ValueError("Move id is required")

    old_con = int(stats.get("con") or 0)
    stats[stat_id] = int(stats[stat_id]) + 1
    updated["stats"] = stats

    moves = [str(m) for m in (updated.get("moves") or []) if m]
    if granted_id not in moves:
        moves.append(granted_id)
    updated["moves"] = moves

    updated["xp"] = xp - cost
    updated["level"] = level + 1

    try:
        updated["stat_modifiers"] = {
            sid: int(codex.skills.get_modifier(int(val)))
            for sid, val in stats.items()
        }
    except Exception:
        pass

    if stat_id == "con":
        new_con = int(stats.get("con") or 0)
        delta = new_con - old_con
        pb = _playbook(codex, _playbook_id(updated))
        if pb is not None:
            base_hp = int(getattr(pb, "base_hp", 0) or 0)
            new_max = base_hp + new_con
            old_max = int(updated.get("max_hp") or 0)
            if old_max <= 0:
                updated["max_hp"] = new_max
                updated["hp"] = int(updated.get("hp") or 0) + max(0, delta)
            else:
                updated["max_hp"] = new_max
                updated["hp"] = int(updated.get("hp") or 0) + max(0, new_max - old_max)
        else:
            updated["max_hp"] = int(updated.get("max_hp") or 0) + max(0, delta)
            updated["hp"] = int(updated.get("hp") or 0) + max(0, delta)

    return updated
