"""Add reviewer_id on character_application.

Revision ID: b4c5d6e7f8a9
Revises: f3a4b5c6d7e8
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b4c5d6e7f8a9"
down_revision: Union[str, None] = "f3a4b5c6d7e8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = {c["name"] for c in insp.get_columns("character_application")}
    if "reviewer_id" not in cols:
        op.add_column(
            "character_application",
            sa.Column("reviewer_id", sa.Uuid(), nullable=True),
        )
        op.create_index(
            "ix_character_application_reviewer_id",
            "character_application",
            ["reviewer_id"],
        )
        op.create_foreign_key(
            "fk_character_application_reviewer_id_user",
            "character_application",
            "user",
            ["reviewer_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = {c["name"] for c in insp.get_columns("character_application")}
    if "reviewer_id" not in cols:
        return
    op.drop_constraint(
        "fk_character_application_reviewer_id_user",
        "character_application",
        type_="foreignkey",
    )
    op.drop_index(
        "ix_character_application_reviewer_id",
        table_name="character_application",
    )
    op.drop_column("character_application", "reviewer_id")
