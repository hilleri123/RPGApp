"""Стол Переговорки, реплики и метки игрового времени.

Revision ID: y4z5a6b7c8d9
Revises: x3y4z5a6b7c8
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "y4z5a6b7c8d9"
down_revision: Union[str, None] = "x3y4z5a6b7c8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(insp, name: str) -> bool:
    return name in insp.get_table_names()


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if not _has_table(insp, "game_time_mark"):
        op.create_table(
            "game_time_mark",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("session_id", sa.Uuid(), sa.ForeignKey("game_session.id", ondelete="CASCADE"), nullable=False),
            sa.Column("real_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("game_time", sa.String(), nullable=False),
        )
        op.create_index("ix_game_time_mark_session_id", "game_time_mark", ["session_id"])
        op.create_index("ix_game_time_mark_real_at", "game_time_mark", ["real_at"])
    if not _has_table(insp, "table_session"):
        op.create_table(
            "table_session",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("game_session_id", sa.Uuid(), sa.ForeignKey("game_session.id", ondelete="CASCADE"), nullable=False),
            sa.Column("room_url", sa.String(), nullable=False),
            sa.Column("domain", sa.String(), nullable=False),
            sa.Column("room_code", sa.String(), nullable=False),
            sa.Column("password", sa.String(), nullable=True),
            sa.Column("status", sa.String(), nullable=False),
            sa.Column("status_detail", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("joined_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("left_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("ix_table_session_game_session_id", "table_session", ["game_session_id"])
    if not _has_table(insp, "table_participant"):
        op.create_table(
            "table_participant",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("table_session_id", sa.Uuid(), sa.ForeignKey("table_session.id", ondelete="CASCADE"), nullable=False),
            sa.Column("jitsi_id", sa.String(), nullable=False),
            sa.Column("display_name", sa.String(), nullable=False),
            sa.Column("character_id", sa.Uuid(), sa.ForeignKey("player_character.id", ondelete="SET NULL"), nullable=True),
        )
        op.create_index("ix_table_participant_table_session_id", "table_participant", ["table_session_id"])
    if not _has_table(insp, "table_segment"):
        op.create_table(
            "table_segment",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("table_session_id", sa.Uuid(), sa.ForeignKey("table_session.id", ondelete="CASCADE"), nullable=False),
            sa.Column("participant_id", sa.Uuid(), sa.ForeignKey("table_participant.id", ondelete="CASCADE"), nullable=False),
            sa.Column("file_path", sa.String(), nullable=False),
            sa.Column("real_started_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("real_ended_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("status", sa.String(), nullable=False),
            sa.Column("error", sa.Text(), nullable=True),
        )
        op.create_index("ix_table_segment_table_session_id", "table_segment", ["table_session_id"])
        op.create_index("ix_table_segment_participant_id", "table_segment", ["participant_id"])
    if not _has_table(insp, "table_utterance"):
        op.create_table(
            "table_utterance",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("table_session_id", sa.Uuid(), sa.ForeignKey("table_session.id", ondelete="CASCADE"), nullable=False),
            sa.Column("segment_id", sa.Uuid(), sa.ForeignKey("table_segment.id", ondelete="CASCADE"), nullable=False),
            sa.Column("participant_id", sa.Uuid(), sa.ForeignKey("table_participant.id", ondelete="SET NULL"), nullable=True),
            sa.Column("text", sa.Text(), nullable=False),
            sa.Column("confidence", sa.Float(), nullable=True),
            sa.Column("real_started_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("real_ended_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("game_time", sa.String(), nullable=True),
            sa.Column("provider", sa.String(), nullable=False),
        )
        op.create_index("ix_table_utterance_table_session_id", "table_utterance", ["table_session_id"])
        op.create_index("ix_table_utterance_segment_id", "table_utterance", ["segment_id"])
    if not _has_table(insp, "table_recap"):
        op.create_table(
            "table_recap",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("table_session_id", sa.Uuid(), sa.ForeignKey("table_session.id", ondelete="CASCADE"), nullable=False),
            sa.Column("text", sa.Text(), nullable=False),
            sa.Column("images", sa.JSON(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_table_recap_table_session_id", "table_recap", ["table_session_id"])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    for name in (
        "table_recap",
        "table_utterance",
        "table_segment",
        "table_participant",
        "table_session",
        "game_time_mark",
    ):
        if _has_table(insp, name):
            op.drop_table(name)
