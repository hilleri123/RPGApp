"""session scenario snapshot fields

Revision ID: a1b2c3d4e5f6
Revises: c6f55edaf1e4
Create Date: 2026-06-25 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "c6f55edaf1e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "scenario",
        sa.Column("source_scenario_id", sa.Uuid(), nullable=True),
    )
    op.add_column(
        "scenario",
        sa.Column(
            "is_session_snapshot",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.create_foreign_key(
        "fk_scenario_source_scenario_id",
        "scenario",
        "scenario",
        ["source_scenario_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_scenario_is_session_snapshot",
        "scenario",
        ["is_session_snapshot"],
    )


def downgrade() -> None:
    op.drop_index("ix_scenario_is_session_snapshot", table_name="scenario")
    op.drop_constraint("fk_scenario_source_scenario_id", "scenario", type_="foreignkey")
    op.drop_column("scenario", "is_session_snapshot")
    op.drop_column("scenario", "source_scenario_id")
