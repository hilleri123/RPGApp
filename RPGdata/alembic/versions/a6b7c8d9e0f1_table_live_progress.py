"""Живой вес и длительность записи, пока дорожка ещё открыта.

Revision ID: a6b7c8d9e0f1
Revises: z5a6b7c8d9e0
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a6b7c8d9e0f1"
down_revision: Union[str, None] = "z5a6b7c8d9e0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    columns = {col["name"] for col in insp.get_columns("table_participant")}
    if "live_bytes" not in columns:
        op.add_column(
            "table_participant",
            sa.Column("live_bytes", sa.BigInteger(), nullable=False, server_default="0"),
        )
    if "live_seconds" not in columns:
        op.add_column(
            "table_participant",
            sa.Column("live_seconds", sa.Float(), nullable=False, server_default="0"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    columns = {col["name"] for col in insp.get_columns("table_participant")}
    if "live_seconds" in columns:
        op.drop_column("table_participant", "live_seconds")
    if "live_bytes" in columns:
        op.drop_column("table_participant", "live_bytes")
