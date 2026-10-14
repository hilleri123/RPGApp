"""Chronicle lines for session history.

Revision ID: v1w2x3y4z5a6
Revises: u0v1w2x3y4z5
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "v1w2x3y4z5a6"
down_revision: Union[str, None] = "u0v1w2x3y4z5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "chronicle_line" in insp.get_table_names():
        return

    op.create_table(
        "chronicle_line",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column(
            "scenario_id",
            sa.Uuid(),
            sa.ForeignKey("scenario.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("text", sa.String(), nullable=False, server_default=""),
        sa.Column("subject_kind", sa.String(), nullable=True),
        sa.Column("subject_id", sa.Uuid(), nullable=True),
        sa.Column(
            "real_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("game_time", sa.String(), nullable=True),
        sa.Column("scene_id", sa.Uuid(), nullable=True),
        sa.Column("scene_time", sa.String(), nullable=True),
        sa.Column("location_id", sa.Uuid(), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column(
            "author_user_id",
            sa.Uuid(),
            sa.ForeignKey("user.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_chronicle_line_scenario_id", "chronicle_line", ["scenario_id"])
    op.create_index("ix_chronicle_line_kind", "chronicle_line", ["kind"])
    op.create_index("ix_chronicle_line_subject_id", "chronicle_line", ["subject_id"])
    op.create_index("ix_chronicle_line_scene_id", "chronicle_line", ["scene_id"])


def downgrade() -> None:
    op.drop_index("ix_chronicle_line_scene_id", table_name="chronicle_line")
    op.drop_index("ix_chronicle_line_subject_id", table_name="chronicle_line")
    op.drop_index("ix_chronicle_line_kind", table_name="chronicle_line")
    op.drop_index("ix_chronicle_line_scenario_id", table_name="chronicle_line")
    op.drop_table("chronicle_line")
