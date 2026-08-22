"""Add map_width/map_height for location canvas size.

Revision ID: o4p5q6r7s8t9
Revises: n3o4p5q6r7s8
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "o4p5q6r7s8t9"
down_revision: Union[str, None] = "n3o4p5q6r7s8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = {c["name"] for c in insp.get_columns("location")}
    if "map_width" not in cols:
        op.add_column("location", sa.Column("map_width", sa.Integer(), nullable=True))
    if "map_height" not in cols:
        op.add_column("location", sa.Column("map_height", sa.Integer(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = {c["name"] for c in insp.get_columns("location")}
    if "map_height" in cols:
        op.drop_column("location", "map_height")
    if "map_width" in cols:
        op.drop_column("location", "map_width")
