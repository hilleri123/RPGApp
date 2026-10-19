"""Музыка в Jitsi и отчёт кнопки «Тест».

Revision ID: z5a6b7c8d9e0
Revises: y4z5a6b7c8d9
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "z5a6b7c8d9e0"
down_revision: Union[str, None] = "y4z5a6b7c8d9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    columns = {col["name"] for col in insp.get_columns("table_session")}
    if "music_enabled" not in columns:
        op.add_column(
            "table_session",
            sa.Column("music_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        )
    if "test_requested" not in columns:
        op.add_column(
            "table_session",
            sa.Column("test_requested", sa.Boolean(), nullable=False, server_default=sa.false()),
        )
    if "test_report" not in columns:
        op.add_column("table_session", sa.Column("test_report", sa.Text(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    columns = {col["name"] for col in insp.get_columns("table_session")}
    for name in ("test_report", "test_requested", "music_enabled"):
        if name in columns:
            op.drop_column("table_session", name)
