"""Add name_pack tables for random name composer.

Revision ID: m2n3o4p5q6r7
Revises: l1m2n3o4p5q6
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "m2n3o4p5q6r7"
down_revision: Union[str, None] = "l1m2n3o4p5q6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "name_pack",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("tags", sa.JSON(), nullable=False, server_default="[]"),
    )

    op.create_table(
        "name_pack_entry",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("pack_id", sa.Uuid(), sa.ForeignKey("name_pack.id", ondelete="CASCADE"), nullable=False),
        sa.Column("text", sa.String(), nullable=False),
        sa.Column("part_kind", sa.String(), nullable=False, server_default="full"),
        sa.Column("tags", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_name_pack_entry_pack_id", "name_pack_entry", ["pack_id"])
    op.create_index("ix_name_pack_entry_part_kind", "name_pack_entry", ["part_kind"])

    op.create_table(
        "scenario_name_pack_link",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("scenario_id", sa.Uuid(), sa.ForeignKey("scenario.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name_pack_id", sa.Uuid(), sa.ForeignKey("name_pack.id", ondelete="CASCADE"), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("order_num", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("scenario_id", "name_pack_id", name="uq_scenario_name_pack_link"),
    )
    op.create_index("ix_scenario_name_pack_link_scenario_id", "scenario_name_pack_link", ["scenario_id"])
    op.create_index("ix_scenario_name_pack_link_name_pack_id", "scenario_name_pack_link", ["name_pack_id"])


def downgrade() -> None:
    op.drop_table("scenario_name_pack_link")
    op.drop_table("name_pack_entry")
    op.drop_table("name_pack")
