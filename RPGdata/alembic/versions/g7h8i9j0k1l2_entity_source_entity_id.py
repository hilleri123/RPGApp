"""Add source_entity_id to scenario entities for prep/launched lineage.

Revision ID: g7h8i9j0k1l2
Revises: f6a7b8c9d0e1
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "g7h8i9j0k1l2"
down_revision: Union[str, None] = "f6a7b8c9d0e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLES = (
    "location",
    "map_object_polygon",
    "npc",
    "game_item",
    "player_character",
    "obstacle",
    "note",
    "counter",
    "story_beat",
    "scene_exposure",
    "scenario_todo",
)


def upgrade() -> None:
    for table in _TABLES:
        op.add_column(table, sa.Column("source_entity_id", sa.Uuid(), nullable=True))
        op.create_foreign_key(
            f"fk_{table}_source_entity_id",
            table,
            table,
            ["source_entity_id"],
            ["id"],
            ondelete="SET NULL",
        )
        op.create_index(f"ix_{table}_source_entity_id", table, ["source_entity_id"])


def downgrade() -> None:
    for table in reversed(_TABLES):
        op.drop_index(f"ix_{table}_source_entity_id", table_name=table)
        op.drop_constraint(f"fk_{table}_source_entity_id", table, type_="foreignkey")
        op.drop_column(table, "source_entity_id")
