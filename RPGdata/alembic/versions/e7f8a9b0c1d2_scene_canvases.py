"""Map overlay rows and a manual-name flag on polygons.

Revision ID: e7f8a9b0c1d2
Revises: d6e7f8a9b0c1
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e7f8a9b0c1d2"
down_revision: Union[str, None] = "d6e7f8a9b0c1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "session_map_overlay",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("session_id", sa.Uuid(), sa.ForeignKey("game_session.id", ondelete="CASCADE"), nullable=False),
        sa.Column("body", sa.JSON(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("changed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_session_map_overlay_session_id", "session_map_overlay", ["session_id"])
    op.add_column(
        "map_object_polygon",
        sa.Column("name_is_manual", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("map_object_polygon", "name_is_manual")
    op.drop_index("ix_session_map_overlay_session_id", table_name="session_map_overlay")
    op.drop_table("session_map_overlay")
