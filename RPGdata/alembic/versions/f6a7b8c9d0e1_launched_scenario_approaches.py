"""launched scenario, parties, approaches

Revision ID: f6a7b8c9d0e1
Revises: d4e5f6a7b8c9
Create Date: 2026-06-25

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("scenario", sa.Column("lifecycle_status", sa.String(), nullable=True))
    op.add_column("scenario", sa.Column("launch_mode", sa.String(), nullable=True))

    op.create_table(
        "scenario_party",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("launched_scenario_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("filter_tags", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["launched_scenario_id"], ["scenario.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_scenario_party_launched", "scenario_party", ["launched_scenario_id"])

    op.create_table(
        "scenario_party_member",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("party_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["party_id"], ["scenario_party.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("party_id", "user_id", name="uq_scenario_party_member"),
    )

    op.create_table(
        "player_seen_state",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("launched_scenario_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("seen_ids", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("polygon_shown_ids", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["launched_scenario_id"], ["scenario.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("launched_scenario_id", "user_id", name="uq_player_seen_launched_user"),
    )

    op.add_column("game_session", sa.Column("launched_scenario_id", sa.Uuid(), nullable=True))
    op.add_column("game_session", sa.Column("party_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_game_session_launched_scenario",
        "game_session",
        "scenario",
        ["launched_scenario_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_game_session_party",
        "game_session",
        "scenario_party",
        ["party_id"],
        ["id"],
    )
    op.create_index("ix_game_session_launched_scenario", "game_session", ["launched_scenario_id"])

    op.add_column("campaign", sa.Column("prep_scenario_id", sa.Uuid(), nullable=True))
    op.add_column("campaign", sa.Column("launched_scenario_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_campaign_prep_scenario",
        "campaign",
        "scenario",
        ["prep_scenario_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_campaign_launched_scenario",
        "campaign",
        "scenario",
        ["launched_scenario_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_campaign_launched_scenario", "campaign", type_="foreignkey")
    op.drop_constraint("fk_campaign_prep_scenario", "campaign", type_="foreignkey")
    op.drop_column("campaign", "launched_scenario_id")
    op.drop_column("campaign", "prep_scenario_id")

    op.drop_index("ix_game_session_launched_scenario", table_name="game_session")
    op.drop_constraint("fk_game_session_party", "game_session", type_="foreignkey")
    op.drop_constraint("fk_game_session_launched_scenario", "game_session", type_="foreignkey")
    op.drop_column("game_session", "party_id")
    op.drop_column("game_session", "launched_scenario_id")

    op.drop_table("player_seen_state")
    op.drop_table("scenario_party_member")
    op.drop_index("ix_scenario_party_launched", table_name="scenario_party")
    op.drop_table("scenario_party")

    op.drop_column("scenario", "launch_mode")
    op.drop_column("scenario", "lifecycle_status")
