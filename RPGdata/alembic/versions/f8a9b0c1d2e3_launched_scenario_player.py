"""Remember a launched-scenario player's character and color.

Revision ID: f8a9b0c1d2e3
Revises: e7f8a9b0c1d2
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f8a9b0c1d2e3"
down_revision: Union[str, None] = "e7f8a9b0c1d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "launched_scenario_player",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "launched_scenario_id",
            sa.Uuid(),
            sa.ForeignKey("scenario.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("user.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "character_id",
            sa.Uuid(),
            sa.ForeignKey("player_character.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("color", sa.String(), nullable=False, server_default="#ffffff"),
        sa.UniqueConstraint(
            "launched_scenario_id",
            "user_id",
            name="uq_launched_scenario_player",
        ),
    )
    op.create_index(
        "ix_launched_scenario_player_launched_scenario_id",
        "launched_scenario_player",
        ["launched_scenario_id"],
    )
    op.create_index(
        "ix_launched_scenario_player_user_id",
        "launched_scenario_player",
        ["user_id"],
    )
    op.create_index(
        "ix_launched_scenario_player_character_id",
        "launched_scenario_player",
        ["character_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_launched_scenario_player_character_id", table_name="launched_scenario_player")
    op.drop_index("ix_launched_scenario_player_user_id", table_name="launched_scenario_player")
    op.drop_index(
        "ix_launched_scenario_player_launched_scenario_id",
        table_name="launched_scenario_player",
    )
    op.drop_table("launched_scenario_player")
