"""Add roll_record table for persistent roll history.

Revision ID: l1m2n3o4p5q6
Revises: k0l1m2n3o4p5
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "l1m2n3o4p5q6"
down_revision: Union[str, None] = "k0l1m2n3o4p5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "roll_record",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("session_id", sa.Uuid(), sa.ForeignKey("game_session.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("user.id", ondelete="CASCADE"), nullable=False),
        sa.Column("player_id", sa.Uuid(), sa.ForeignKey("player.id", ondelete="SET NULL"), nullable=True),
        sa.Column("character_id", sa.Uuid(), nullable=True),
        sa.Column("action_id", sa.Uuid(), nullable=True),
        sa.Column("action_key", sa.String(), nullable=True),
        sa.Column("roll_kind", sa.String(), nullable=False, server_default="dice.roll"),
        sa.Column("system_id", sa.String(), nullable=True),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("expression", sa.String(), nullable=True),
        sa.Column("dice", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("total", sa.Integer(), nullable=True),
        sa.Column("outcome", sa.Text(), nullable=True),
        sa.Column("seed_hash", sa.String(length=64), nullable=True),
        sa.Column("seed_image_ref", sa.String(), nullable=True),
        sa.Column("meta", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_roll_record_session_id", "roll_record", ["session_id"])
    op.create_index("ix_roll_record_user_id", "roll_record", ["user_id"])
    op.create_index("ix_roll_record_player_id", "roll_record", ["player_id"])
    op.create_index("ix_roll_record_character_id", "roll_record", ["character_id"])
    op.create_index("ix_roll_record_action_id", "roll_record", ["action_id"])
    op.create_index("ix_roll_record_action_key", "roll_record", ["action_key"])
    op.create_index("ix_roll_record_roll_kind", "roll_record", ["roll_kind"])
    op.create_index("ix_roll_record_system_id", "roll_record", ["system_id"])
    op.create_index("ix_roll_record_seed_hash", "roll_record", ["seed_hash"])
    op.create_index("ix_roll_record_created_at", "roll_record", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_roll_record_created_at", table_name="roll_record")
    op.drop_index("ix_roll_record_seed_hash", table_name="roll_record")
    op.drop_index("ix_roll_record_system_id", table_name="roll_record")
    op.drop_index("ix_roll_record_roll_kind", table_name="roll_record")
    op.drop_index("ix_roll_record_action_key", table_name="roll_record")
    op.drop_index("ix_roll_record_action_id", table_name="roll_record")
    op.drop_index("ix_roll_record_character_id", table_name="roll_record")
    op.drop_index("ix_roll_record_player_id", table_name="roll_record")
    op.drop_index("ix_roll_record_user_id", table_name="roll_record")
    op.drop_index("ix_roll_record_session_id", table_name="roll_record")
    op.drop_table("roll_record")
