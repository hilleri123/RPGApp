"""Add note.parent_note_id and note.sort_order for wiki tree.

Revision ID: s8t9u0v1w2x3
Revises: r7s8t9u0v1w2
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "s8t9u0v1w2x3"
down_revision: Union[str, None] = "r7s8t9u0v1w2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "note",
        sa.Column("parent_note_id", sa.Uuid(), nullable=True),
    )
    op.add_column(
        "note",
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_note_parent_note_id", "note", ["parent_note_id"])
    op.create_foreign_key(
        "fk_note_parent_note_id",
        "note",
        "note",
        ["parent_note_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_note_parent_note_id", "note", type_="foreignkey")
    op.drop_index("ix_note_parent_note_id", table_name="note")
    op.drop_column("note", "sort_order")
    op.drop_column("note", "parent_note_id")
