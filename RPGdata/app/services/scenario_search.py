"""Unified search over the entities of one scenario."""

from __future__ import annotations

import html
import re
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.constants.location_kinds import is_kind_tag, kind_of

# type -> (model, name column, searchable text columns). `type` ids match the client tabs.
_SPECS: dict[str, tuple[Any, str, tuple[str, ...]]] = {
    "story_beat": (models.StoryBeat, "name", ("text_for_master", "text_for_players")),
    "location": (models.Location, "name", ("description_for_master", "description_for_players")),
    "npc": (models.NPC, "name", ("description_for_master", "description_for_players")),
    "game_item": (models.GameItem, "name", ("description_for_master", "description_for_players")),
    "player_character": (models.PlayerCharacter, "name", ("short_desc", "story")),
    "note": (models.Note, "name", ("text",)),
    "counter": (models.Counter, "name", ("description",)),
    "front": (models.Front, "name", ("description_for_master",)),
}

SEARCH_TYPES = tuple(_SPECS)
_PER_TYPE_LIMIT = 50
_SNIPPET_RADIUS = 60


@dataclass
class SearchHit:
    type: str
    id: UUID
    name: str
    snippet: str
    tags: list[str]
    kind: str | None = None
    name_match: bool = False


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", r"\%").replace("_", r"\_")


def _plain(text: str | None) -> str:
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def make_snippet(texts: list[str | None], query: str) -> str:
    """Fragment of the first text that contains ``query`` (else the start of the first text)."""
    plain = [_plain(t) for t in texts if t]
    if not plain:
        return ""
    needle = query.lower().strip()
    if needle:
        for text in plain:
            pos = text.lower().find(needle)
            if pos >= 0:
                start = max(0, pos - _SNIPPET_RADIUS)
                end = min(len(text), pos + len(needle) + _SNIPPET_RADIUS)
                return ("…" if start else "") + text[start:end] + ("…" if end < len(text) else "")
    return plain[0][: _SNIPPET_RADIUS * 2]


async def search_scenario(
    db: AsyncSession,
    scenario_id: UUID,
    *,
    q: str | None = None,
    types: list[str] | None = None,
    tags: list[str] | None = None,
    limit: int = 50,
) -> list[SearchHit]:
    needle = (q or "").strip()
    wanted_tags = {t for t in (tags or []) if t}
    if not needle and not wanted_tags:
        return []

    selected = [t for t in (types or SEARCH_TYPES) if t in _SPECS]
    limit = max(1, min(limit, 200))
    hits: list[SearchHit] = []

    for type_id in selected:
        model, name_col, text_cols = _SPECS[type_id]
        stmt = select(model).where(model.scenario_id == scenario_id)
        if needle:
            pattern = f"%{_escape_like(needle)}%"
            stmt = stmt.where(
                or_(
                    *[
                        getattr(model, col).ilike(pattern, escape="\\")
                        for col in (name_col, *text_cols)
                    ]
                )
            )
        rows = (await db.execute(stmt.order_by(getattr(model, name_col)).limit(500))).scalars().all()

        per_type = 0
        for row in rows:
            row_tags = [str(t) for t in (getattr(row, "tags", None) or [])]
            if wanted_tags and not wanted_tags.issubset(row_tags):
                continue
            name = getattr(row, name_col) or ""
            hits.append(
                SearchHit(
                    type=type_id,
                    id=row.id,
                    name=name,
                    snippet=make_snippet([getattr(row, c) for c in text_cols], needle),
                    tags=[t for t in row_tags if not is_kind_tag(t)],
                    kind=kind_of(row_tags) if type_id == "location" else None,
                    name_match=bool(needle) and needle.lower() in name.lower(),
                )
            )
            per_type += 1
            if per_type >= _PER_TYPE_LIMIT:
                break

    # Совпадения в названии важнее совпадений в тексте; дальше по типу и алфавиту.
    hits.sort(key=lambda h: (not h.name_match, SEARCH_TYPES.index(h.type), h.name.lower()))
    return hits[:limit]
