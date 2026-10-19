"""Галка автоматического входа бота в Переговорку.

Revision ID: f3a4b5c6d7e8
Revises: e1f2a3b4c5d6
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f3a4b5c6d7e8"
down_revision: Union[str, None] = "e1f2a3b4c5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    columns = {col["name"] for col in insp.get_columns("table_session")}
    if "auto_connect" not in columns:
        op.add_column(
            "table_session",
            sa.Column("auto_connect", sa.Boolean(), nullable=False, server_default=sa.false()),
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    columns = {col["name"] for col in insp.get_columns("table_session")}
    if "auto_connect" in columns:
        op.drop_column("table_session", "auto_connect")
