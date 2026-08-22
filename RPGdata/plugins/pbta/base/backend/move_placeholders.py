from __future__ import annotations

import re
from typing import Any

from plugins.pbta.base.backend.types.types_classes import Move, MovePlaceholder

_TOKEN_RE = re.compile(r"\{\{(\w+)\}\}")


def _pick_value(picks: dict[str, str] | None, placeholder_id: str) -> str:
    if not picks:
        return ""
    return str(picks.get(placeholder_id) or "").strip()


def _label_for_enum(ph: MovePlaceholder, value: str) -> str:
    for opt in ph.options or []:
        if opt.id == value:
            return opt.label
    return value


def label_for_pick(
    ph: MovePlaceholder,
    value: str,
    moves_map: dict[str, Move] | None = None,
) -> str:
    if not value:
        return ""
    if ph.kind == "enum":
        return _label_for_enum(ph, value)
    if ph.kind == "move_pick" and moves_map:
        move = moves_map.get(value)
        if move:
            return move.title
    return value


def resolve_move_field(
    text: str,
    placeholders: list[MovePlaceholder],
    picks: dict[str, str] | None,
    moves_map: dict[str, Move] | None = None,
) -> str:
    if not text:
        return text

    ph_by_id = {ph.id: ph for ph in placeholders}

    def repl(match: re.Match[str]) -> str:
        pid = match.group(1)
        ph = ph_by_id.get(pid)
        raw = _pick_value(picks, pid)
        if not raw:
            return f"[{ph.label if ph else pid}]"
        return label_for_pick(ph, raw, moves_map) if ph else raw

    return _TOKEN_RE.sub(repl, text)


def missing_required_placeholders(
    move: Move,
    picks: dict[str, str] | None,
) -> list[MovePlaceholder]:
    missing: list[MovePlaceholder] = []
    for ph in move.placeholders or []:
        if not ph.required:
            continue
        if not _pick_value(picks, ph.id):
            missing.append(ph)
    return missing


def options_for_move_pick(
    *,
    playbooks: list[Any],
    moves_map: dict[str, Move],
    playbook_id: str,
    character_level: int,
    placeholder: MovePlaceholder,
) -> list[dict[str, str]]:
    effective_level = max(1, int(character_level) + int(placeholder.level_delta or -1))
    allow_advanced = effective_level >= 2
    out: list[dict[str, str]] = []

    for pb in playbooks:
        pb_id = getattr(pb, "id", None) or (pb.get("id") if isinstance(pb, dict) else None)
        if not pb_id or pb_id == playbook_id:
            continue
        pb_title = getattr(pb, "title", None) or (pb.get("title") if isinstance(pb, dict) else pb_id)
        starting = list(getattr(pb, "starting_moves", None) or (pb.get("starting_moves") if isinstance(pb, dict) else []) or [])
        advanced = list(getattr(pb, "advanced_moves", None) or (pb.get("advanced_moves") if isinstance(pb, dict) else []) or [])

        move_ids = list(starting)
        if allow_advanced:
            move_ids.extend(advanced)

        for mid in move_ids:
            move = moves_map.get(mid)
            if not move:
                continue
            out.append({
                "id": mid,
                "label": f"{pb_title}: {move.title}",
            })

    out.sort(key=lambda x: x["label"].lower())
    return out
