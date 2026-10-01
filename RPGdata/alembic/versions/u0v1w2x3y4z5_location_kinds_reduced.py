"""Reduce location kinds to a fixed hierarchy: rewrite legacy ``loc:*`` tags.

continent/ocean/island/country -> region, wilderness/forest/mountains -> wilds,
village -> city, street -> district, tavern/ship -> building, apartment -> room,
``loc:other`` is dropped. Downgrade is a no-op (the original kinds are not recoverable);
the application also maps legacy ids on read, so a skipped migration is harmless.

Revision ID: u0v1w2x3y4z5
Revises: t9u0v1w2x3y4
"""

from __future__ import annotations

import json
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "u0v1w2x3y4z5"
down_revision: Union[str, None] = "t9u0v1w2x3y4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Frozen copy: a migration must not depend on later edits of the app constants.
_KINDS = {"world", "region", "city", "wilds", "dungeon", "district", "building", "room"}
_ALIASES = {
    "continent": "region",
    "ocean": "region",
    "island": "region",
    "country": "region",
    "wilderness": "wilds",
    "forest": "wilds",
    "mountains": "wilds",
    "village": "city",
    "street": "district",
    "tavern": "building",
    "ship": "building",
    "apartment": "room",
    "other": None,
}
_PREFIX = "loc:"


def _rewrite(tags: list) -> list | None:
    """New tag list, or None when nothing has to change."""
    out: list = []
    kind: str | None = None
    changed = False
    for tag in tags:
        if isinstance(tag, str) and tag.startswith(_PREFIX):
            raw = tag[len(_PREFIX):]
            canonical = raw if raw in _KINDS else _ALIASES.get(raw)
            if canonical is None:
                changed = True  # loc:other / unknown: drop
                continue
            if kind is not None:
                changed = True  # at most one kind
                continue
            kind = canonical
            if canonical != raw:
                changed = True
            out.append(f"{_PREFIX}{canonical}")
        else:
            out.append(tag)
    return out if changed else None


def upgrade() -> None:
    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT id, tags FROM location WHERE tags IS NOT NULL")).fetchall()
    for loc_id, tags in rows:
        if isinstance(tags, str):
            try:
                tags = json.loads(tags)
            except ValueError:
                continue
        if not isinstance(tags, list):
            continue
        new_tags = _rewrite(tags)
        if new_tags is None:
            continue
        bind.execute(
            sa.text("UPDATE location SET tags = CAST(:tags AS json) WHERE id = :id"),
            {"tags": json.dumps(new_tags, ensure_ascii=False), "id": loc_id},
        )


def downgrade() -> None:
    pass
