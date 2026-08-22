"""Drop rule_id_str from name_pack (narrative, not rules-scoped).

Revision ID: n3o4p5q6r7s8
Revises: m2n3o4p5q6r7
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "n3o4p5q6r7s8"
down_revision: Union[str, None] = "m2n3o4p5q6r7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = {c["name"] for c in insp.get_columns("name_pack")}
    if "rule_id_str" not in cols:
        return
    op.drop_index("ix_name_pack_rule_id_str", table_name="name_pack")
    op.drop_column("name_pack", "rule_id_str")


def downgrade() -> None:
    op.add_column("name_pack", sa.Column("rule_id_str", sa.String(), nullable=True))
    op.execute(sa.text("UPDATE name_pack SET rule_id_str = '' WHERE rule_id_str IS NULL"))
    op.alter_column("name_pack", "rule_id_str", nullable=False)
    op.create_index("ix_name_pack_rule_id_str", "name_pack", ["rule_id_str"])
