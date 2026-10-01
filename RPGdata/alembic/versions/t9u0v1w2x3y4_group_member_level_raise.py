"""BE-28: member level becomes a ceiling; raise existing members so nobody is downgraded.

Every membership row was created with ``read`` while the level was ignored. Now that
``min(member, group grant)`` is enforced, existing rows are raised to ``all`` so the
effective access stays exactly what the group grants.

Revision ID: t9u0v1w2x3y4
Revises: s8t9u0v1w2x3
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "t9u0v1w2x3y4"
down_revision: Union[str, None] = "s8t9u0v1w2x3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE user_master_group SET permission = 'all'")


def downgrade() -> None:
    # Original values are not recoverable (all rows were 'read').
    op.execute("UPDATE user_master_group SET permission = 'read'")
