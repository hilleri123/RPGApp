"""note owner_user_id and owner_role

Revision ID: d4e5f6a7b8c9
Revises: b7c8d9e0f1a2
Create Date: 2026-06-29

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c8d9e0f1a2b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("note", sa.Column("owner_user_id", sa.Uuid(), nullable=True))
    op.add_column("note", sa.Column("owner_role", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("note", "owner_role")
    op.drop_column("note", "owner_user_id")
