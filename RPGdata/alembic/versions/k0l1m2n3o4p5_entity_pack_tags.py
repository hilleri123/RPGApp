"""Add tags column to entity_pack.

Revision ID: k0l1m2n3o4p5
Revises: j9k0l1m2n3o4
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "k0l1m2n3o4p5"
down_revision: Union[str, None] = "j9k0l1m2n3o4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("entity_pack", sa.Column("tags", sa.JSON(), nullable=True))

    op.execute(
        sa.text(
            """
            UPDATE entity_pack
            SET tags = CAST(:default_tags AS json)
            WHERE name LIKE 'Пак шаблонов:%'
            """
        ).bindparams(default_tags='["default"]')
    )
    op.execute(sa.text("UPDATE entity_pack SET tags = '[]'::json WHERE tags IS NULL"))
    op.alter_column("entity_pack", "tags", nullable=False, server_default="[]")


def downgrade() -> None:
    op.drop_column("entity_pack", "tags")
