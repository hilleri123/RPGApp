"""Prepared dice-seed queue for a seated player.

Revision ID: w2x3y4z5a6b7
Revises: v1w2x3y4z5a6
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "w2x3y4z5a6b7"
down_revision: Union[str, None] = "v1w2x3y4z5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "prepared_roll_seed" in insp.get_table_names():
        return

    op.create_table(
        "prepared_roll_seed",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column(
            "player_id",
            sa.Uuid(),
            sa.ForeignKey("player.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("image", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_prepared_roll_seed_player_id", "prepared_roll_seed", ["player_id"])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "prepared_roll_seed" not in insp.get_table_names():
        return
    op.drop_index("ix_prepared_roll_seed_player_id", table_name="prepared_roll_seed")
    op.drop_table("prepared_roll_seed")
