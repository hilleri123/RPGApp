"""Authors of Flaticon icons downloaded onto this site.

Revision ID: b0c1d2e3f4a5
Revises: a9b0c1d2e3f4
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b0c1d2e3f4a5"
down_revision: Union[str, None] = "a9b0c1d2e3f4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "flaticon_credit",
        sa.Column("icon_id", sa.Integer(), nullable=False),
        sa.Column("author_name", sa.String(length=200), nullable=False),
        sa.Column("author_url", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("icon_id"),
    )


def downgrade() -> None:
    op.drop_table("flaticon_credit")
