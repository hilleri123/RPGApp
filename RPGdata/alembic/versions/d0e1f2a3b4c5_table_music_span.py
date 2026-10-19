"""Отрезки музыки: какой файл и какой кусок играл стол.

Revision ID: d0e1f2a3b4c5
Revises: c9d0e1f2a3b4
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d0e1f2a3b4c5"
down_revision: Union[str, None] = "c9d0e1f2a3b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "table_music_span" in set(insp.get_table_names()):
        return
    op.create_table(
        "table_music_span",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("table_session_id", sa.Uuid(), nullable=False),
        sa.Column("path", sa.String(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("position_start", sa.Float(), nullable=False),
        sa.Column("position_end", sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(["table_session_id"], ["table_session.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_table_music_span_table_session_id", "table_music_span", ["table_session_id"])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "table_music_span" not in set(insp.get_table_names()):
        return
    op.drop_index("ix_table_music_span_table_session_id", table_name="table_music_span")
    op.drop_table("table_music_span")
