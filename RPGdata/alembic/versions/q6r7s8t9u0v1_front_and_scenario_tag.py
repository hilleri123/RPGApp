"""Add Front, ScenarioTag pool, FrontMember, FrontWikiNote; Counter.tags.

Revision ID: q6r7s8t9u0v1
Revises: p5q6r7s8t9u0
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "q6r7s8t9u0v1"
down_revision: Union[str, None] = "p5q6r7s8t9u0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if "counter" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("counter")}
        if "tags" not in cols:
            op.add_column("counter", sa.Column("tags", sa.JSON(), nullable=True))

    if "scenario_tag" not in insp.get_table_names():
        op.create_table(
            "scenario_tag",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("scenario_id", sa.Uuid(), nullable=False),
            sa.Column("key", sa.String(), nullable=False),
            sa.Column("label", sa.String(), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("color", sa.String(), nullable=True),
            sa.Column("kind", sa.String(), nullable=False, server_default="manual"),
            sa.Column("front_id", sa.Uuid(), nullable=True),
            sa.ForeignKeyConstraint(["scenario_id"], ["scenario.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("scenario_id", "key", name="uq_scenario_tag_scenario_key"),
        )
        op.create_index("ix_scenario_tag_id", "scenario_tag", ["id"])
        op.create_index("ix_scenario_tag_scenario_id", "scenario_tag", ["scenario_id"])
        op.create_index("ix_scenario_tag_key", "scenario_tag", ["key"])
        op.create_index("ix_scenario_tag_front_id", "scenario_tag", ["front_id"])

    if "front" not in insp.get_table_names():
        op.create_table(
            "front",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("scenario_id", sa.Uuid(), nullable=False),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("description_for_master", sa.Text(), nullable=True),
            sa.Column("color", sa.String(), nullable=False, server_default="#7c3aed"),
            sa.Column("icon_url", sa.String(length=256), nullable=True),
            sa.Column("tag_id", sa.Uuid(), nullable=False),
            sa.ForeignKeyConstraint(["scenario_id"], ["scenario.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["tag_id"], ["scenario_tag.id"], ondelete="RESTRICT"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_front_id", "front", ["id"])
        op.create_index("ix_front_scenario_id", "front", ["scenario_id"])
        op.create_index("ix_front_tag_id", "front", ["tag_id"])

    insp = sa.inspect(bind)
    fks = {fk.get("name") for fk in insp.get_foreign_keys("scenario_tag")}
    if "fk_scenario_tag_front_id" not in fks:
        op.create_foreign_key(
            "fk_scenario_tag_front_id",
            "scenario_tag",
            "front",
            ["front_id"],
            ["id"],
            ondelete="SET NULL",
        )

    if "front_member" not in insp.get_table_names():
        op.create_table(
            "front_member",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("front_id", sa.Uuid(), nullable=False),
            sa.Column("entity_type", sa.String(), nullable=False),
            sa.Column("entity_id", sa.Uuid(), nullable=False),
            sa.ForeignKeyConstraint(["front_id"], ["front.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "front_id", "entity_type", "entity_id", name="uq_front_member_entity"
            ),
        )
        op.create_index("ix_front_member_id", "front_member", ["id"])
        op.create_index("ix_front_member_front_id", "front_member", ["front_id"])
        op.create_index("ix_front_member_entity_id", "front_member", ["entity_id"])

    if "front_wiki_note" not in insp.get_table_names():
        op.create_table(
            "front_wiki_note",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("front_id", sa.Uuid(), nullable=False),
            sa.Column("note_id", sa.Uuid(), nullable=False),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
            sa.ForeignKeyConstraint(["front_id"], ["front.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["note_id"], ["note.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("front_id", "note_id", name="uq_front_wiki_note"),
        )
        op.create_index("ix_front_wiki_note_id", "front_wiki_note", ["id"])
        op.create_index("ix_front_wiki_note_front_id", "front_wiki_note", ["front_id"])
        op.create_index("ix_front_wiki_note_note_id", "front_wiki_note", ["note_id"])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = set(insp.get_table_names())

    if "front_wiki_note" in tables:
        op.drop_table("front_wiki_note")
    if "front_member" in tables:
        op.drop_table("front_member")

    if "scenario_tag" in tables:
        fks = {fk.get("name") for fk in insp.get_foreign_keys("scenario_tag")}
        if "fk_scenario_tag_front_id" in fks:
            op.drop_constraint("fk_scenario_tag_front_id", "scenario_tag", type_="foreignkey")

    if "front" in tables:
        op.drop_table("front")
    if "scenario_tag" in tables:
        op.drop_table("scenario_tag")

    if "counter" in tables:
        cols = {c["name"] for c in insp.get_columns("counter")}
        if "tags" in cols:
            op.drop_column("counter", "tags")
