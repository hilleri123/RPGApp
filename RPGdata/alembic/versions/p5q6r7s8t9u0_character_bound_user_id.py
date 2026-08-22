"""Add bound_user_id on player_character for lobby/session prefill.

Revision ID: p5q6r7s8t9u0
Revises: o4p5q6r7s8t9
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "p5q6r7s8t9u0"
down_revision: Union[str, None] = "o4p5q6r7s8t9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = {c["name"] for c in insp.get_columns("player_character")}
    if "bound_user_id" not in cols:
        op.add_column(
            "player_character",
            sa.Column("bound_user_id", sa.Uuid(), nullable=True),
        )
        op.create_index(
            "ix_player_character_bound_user_id",
            "player_character",
            ["bound_user_id"],
        )
        op.create_foreign_key(
            "fk_player_character_bound_user_id_user",
            "player_character",
            "user",
            ["bound_user_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = {c["name"] for c in insp.get_columns("player_character")}
    if "bound_user_id" not in cols:
        return
    op.drop_constraint(
        "fk_player_character_bound_user_id_user",
        "player_character",
        type_="foreignkey",
    )
    op.drop_index("ix_player_character_bound_user_id", table_name="player_character")
    op.drop_column("player_character", "bound_user_id")
