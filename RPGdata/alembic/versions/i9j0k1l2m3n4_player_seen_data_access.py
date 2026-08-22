"""Add data_access enum column to player_seen.

Revision ID: i9j0k1l2m3n4
Revises: h8i9j0k1l2m3
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "i9j0k1l2m3n4"
down_revision: Union[str, None] = "h8i9j0k1l2m3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "player_seen",
        sa.Column(
            "data_access",
            sa.String(),
            nullable=False,
            server_default="none",
        ),
    )
    op.alter_column("player_seen", "data_access", server_default=None)


def downgrade() -> None:
    op.drop_column("player_seen", "data_access")
