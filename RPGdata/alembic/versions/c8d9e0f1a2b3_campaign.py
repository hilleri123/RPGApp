"""Campaign tables and game_session campaign columns."""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c8d9e0f1a2b3"
down_revision: Union[str, None] = "b7c8d9e0f1a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "campaign",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("master_id", sa.Uuid(), nullable=False),
        sa.Column("rule_id_str", sa.String(), nullable=True),
        sa.Column("current_step_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("carryover_state", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["master_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_campaign_id", "campaign", ["id"])
    op.create_index("ix_campaign_name", "campaign", ["name"])
    op.create_index("ix_campaign_master_id", "campaign", ["master_id"])

    op.create_table(
        "campaign_scenario",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("campaign_id", sa.Uuid(), nullable=False),
        sa.Column("scenario_id", sa.Uuid(), nullable=False),
        sa.Column("order_num", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("title_override", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["campaign_id"], ["campaign.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["scenario_id"], ["scenario.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_campaign_scenario_id", "campaign_scenario", ["id"])
    op.create_index("ix_campaign_scenario_campaign_id", "campaign_scenario", ["campaign_id"])
    op.create_index("ix_campaign_scenario_scenario_id", "campaign_scenario", ["scenario_id"])

    op.add_column("game_session", sa.Column("campaign_id", sa.Uuid(), nullable=True))
    op.add_column("game_session", sa.Column("campaign_step_index", sa.Integer(), nullable=True))
    op.add_column("game_session", sa.Column("prior_session_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_game_session_campaign_id",
        "game_session",
        "campaign",
        ["campaign_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_game_session_prior_session_id",
        "game_session",
        "game_session",
        ["prior_session_id"],
        ["id"],
    )
    op.create_index("ix_game_session_campaign_id", "game_session", ["campaign_id"])


def downgrade() -> None:
    op.drop_index("ix_game_session_campaign_id", table_name="game_session")
    op.drop_constraint("fk_game_session_prior_session_id", "game_session", type_="foreignkey")
    op.drop_constraint("fk_game_session_campaign_id", "game_session", type_="foreignkey")
    op.drop_column("game_session", "prior_session_id")
    op.drop_column("game_session", "campaign_step_index")
    op.drop_column("game_session", "campaign_id")

    op.drop_index("ix_campaign_scenario_scenario_id", table_name="campaign_scenario")
    op.drop_index("ix_campaign_scenario_campaign_id", table_name="campaign_scenario")
    op.drop_index("ix_campaign_scenario_id", table_name="campaign_scenario")
    op.drop_table("campaign_scenario")

    op.drop_index("ix_campaign_master_id", table_name="campaign")
    op.drop_index("ix_campaign_name", table_name="campaign")
    op.drop_index("ix_campaign_id", table_name="campaign")
    op.drop_table("campaign")
