"""Drop the per-player shown-polygon list. Visibility is is_shown on the polygon.

Revision ID: x3y4z5a6b7c8
Revises: w2x3y4z5a6b7
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "x3y4z5a6b7c8"
down_revision: Union[str, None] = "w2x3y4z5a6b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    columns = {col["name"] for col in insp.get_columns("player_seen_state")}
    if "polygon_shown_ids" in columns:
        op.drop_column("player_seen_state", "polygon_shown_ids")


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    columns = {col["name"] for col in insp.get_columns("player_seen_state")}
    if "polygon_shown_ids" not in columns:
        op.add_column(
            "player_seen_state",
            sa.Column("polygon_shown_ids", sa.JSON(), nullable=False, server_default="[]"),
        )
