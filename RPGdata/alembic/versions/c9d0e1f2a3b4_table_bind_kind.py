"""Кого в Jitsi считать мастером, игроком или наблюдателем.

Revision ID: c9d0e1f2a3b4
Revises: a6b7c8d9e0f1
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c9d0e1f2a3b4"
down_revision: Union[str, None] = "a6b7c8d9e0f1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    columns = {col["name"] for col in insp.get_columns("table_participant")}
    if "bind_kind" not in columns:
        op.add_column(
            "table_participant",
            sa.Column("bind_kind", sa.String(), nullable=False, server_default=""),
        )
    if "observer_code" not in columns:
        op.add_column("table_participant", sa.Column("observer_code", sa.String(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    columns = {col["name"] for col in insp.get_columns("table_participant")}
    if "observer_code" in columns:
        op.drop_column("table_participant", "observer_code")
    if "bind_kind" in columns:
        op.drop_column("table_participant", "bind_kind")
