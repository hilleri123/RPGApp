"""Проверочный стол лобби: настройки едут в сессию, запись лобби не хранится.

Revision ID: e1f2a3b4c5d6
Revises: d0e1f2a3b4c5
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e1f2a3b4c5d6"
down_revision: Union[str, None] = "d0e1f2a3b4c5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    columns = {col["name"] for col in insp.get_columns("table_session")}
    if "lobby_id" not in columns:
        op.add_column("table_session", sa.Column("lobby_id", sa.Uuid(), nullable=True))
        op.create_index("ix_table_session_lobby_id", "table_session", ["lobby_id"])
    if "preview" not in columns:
        op.add_column(
            "table_session",
            sa.Column("preview", sa.Boolean(), nullable=False, server_default=sa.false()),
        )
    op.alter_column("table_session", "game_session_id", existing_type=sa.Uuid(), nullable=True)


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    columns = {col["name"] for col in insp.get_columns("table_session")}
    op.alter_column("table_session", "game_session_id", existing_type=sa.Uuid(), nullable=False)
    if "preview" in columns:
        op.drop_column("table_session", "preview")
    if "lobby_id" in columns:
        op.drop_index("ix_table_session_lobby_id", table_name="table_session")
        op.drop_column("table_session", "lobby_id")
