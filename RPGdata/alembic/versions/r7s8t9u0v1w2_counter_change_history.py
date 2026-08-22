"""Add counter_change history table.

Revision ID: r7s8t9u0v1w2
Revises: q6r7s8t9u0v1
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "r7s8t9u0v1w2"
down_revision: Union[str, None] = "q6r7s8t9u0v1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "counter_change" in insp.get_table_names():
        return

    op.create_table(
        "counter_change",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column(
            "counter_id",
            sa.Uuid(),
            sa.ForeignKey("counter.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("delta", sa.Integer(), nullable=False),
        sa.Column("old_value", sa.Integer(), nullable=False),
        sa.Column("new_value", sa.Integer(), nullable=False),
        sa.Column("comment", sa.String(), nullable=True),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("user.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_counter_change_counter_id", "counter_change", ["counter_id"])
    op.create_index("ix_counter_change_user_id", "counter_change", ["user_id"])
    op.create_index("ix_counter_change_created_at", "counter_change", ["created_at"])
    op.create_index("ix_counter_change_id", "counter_change", ["id"])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "counter_change" not in insp.get_table_names():
        return
    op.drop_index("ix_counter_change_id", table_name="counter_change")
    op.drop_index("ix_counter_change_created_at", table_name="counter_change")
    op.drop_index("ix_counter_change_user_id", table_name="counter_change")
    op.drop_index("ix_counter_change_counter_id", table_name="counter_change")
    op.drop_table("counter_change")
