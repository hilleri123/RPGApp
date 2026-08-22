"""player_seen table + copied_from on cloneable entities.

Revision ID: h8i9j0k1l2m3
Revises: g7h8i9j0k1l2
"""
from __future__ import annotations

import json
import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "h8i9j0k1l2m3"
down_revision: Union[str, None] = "g7h8i9j0k1l2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_COPIED_FROM_TABLES = (
    ("npc", "npc"),
    ("game_item", "game_item"),
    ("player_character", "player_character"),
)


def upgrade() -> None:
    for table, ref in _COPIED_FROM_TABLES:
        op.add_column(table, sa.Column("copied_from", sa.Uuid(), nullable=True))
        op.create_foreign_key(
            f"fk_{table}_copied_from",
            table,
            ref,
            ["copied_from"],
            ["id"],
            ondelete="SET NULL",
        )
        op.create_index(f"ix_{table}_copied_from", table, ["copied_from"])

    op.create_table(
        "player_seen",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("launched_scenario_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("entity_type", sa.String(), nullable=False),
        sa.Column("entity_id", sa.Uuid(), nullable=False),
        sa.Column(
            "first_seen_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["launched_scenario_id"],
            ["scenario.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "launched_scenario_id",
            "user_id",
            "entity_type",
            "entity_id",
            name="uq_player_seen_entry",
        ),
    )
    op.create_index("ix_player_seen_launched_user", "player_seen", ["launched_scenario_id", "user_id"])
    op.create_index("ix_player_seen_entity_id", "player_seen", ["entity_id"])

    _migrate_legacy_seen_ids()


def _migrate_legacy_seen_ids() -> None:
    conn = op.get_bind()

    rows = conn.execute(
        sa.text(
            """
            SELECT launched_scenario_id, user_id, seen_ids
            FROM player_seen_state
            WHERE seen_ids IS NOT NULL
            """
        )
    ).fetchall()

    for launched_scenario_id, user_id, seen_ids_raw in rows:
        if not seen_ids_raw:
            continue
        if isinstance(seen_ids_raw, str):
            try:
                seen_ids = json.loads(seen_ids_raw)
            except json.JSONDecodeError:
                continue
        else:
            seen_ids = seen_ids_raw

        scenario_id = launched_scenario_id
        for raw_id in seen_ids or []:
            try:
                entity_uuid = uuid.UUID(str(raw_id))
            except (TypeError, ValueError):
                continue

            entity_type, canonical_id = _resolve_canonical(conn, scenario_id, entity_uuid)
            if not entity_type:
                entity_type = "unknown"
                canonical_id = entity_uuid

            conn.execute(
                sa.text(
                    """
                    INSERT INTO player_seen (id, launched_scenario_id, user_id, entity_type, entity_id)
                    VALUES (:id, :launched_scenario_id, :user_id, :entity_type, :entity_id)
                    ON CONFLICT ON CONSTRAINT uq_player_seen_entry DO NOTHING
                    """
                ),
                {
                    "id": str(uuid.uuid4()),
                    "launched_scenario_id": str(launched_scenario_id),
                    "user_id": str(user_id),
                    "entity_type": entity_type,
                    "entity_id": str(canonical_id),
                },
            )


def _resolve_canonical(conn, scenario_id, entity_id: uuid.UUID) -> tuple[str | None, uuid.UUID | None]:
    row = conn.execute(
        sa.text(
            """
            SELECT id, source_entity_id
            FROM location
            WHERE id = :eid AND scenario_id = :sid
            """
        ),
        {"eid": str(entity_id), "sid": str(scenario_id)},
    ).first()
    if row:
        source = row[1]
        if source:
            return "location", uuid.UUID(str(source))
        return "location", entity_id

    for table, entity_type in (
        ("npc", "npc"),
        ("game_item", "game_item"),
        ("player_character", "player_character"),
    ):
        row = conn.execute(
            sa.text(
                f"""
                SELECT id, copied_from, source_entity_id
                FROM {table}
                WHERE id = :eid AND scenario_id = :sid
                """
            ),
            {"eid": str(entity_id), "sid": str(scenario_id)},
        ).first()
        if row:
            lineage_id = row[1] or row[2]
            if lineage_id:
                return entity_type, uuid.UUID(str(lineage_id))
            return entity_type, entity_id
    return None, None


def downgrade() -> None:
    op.drop_index("ix_player_seen_entity_id", table_name="player_seen")
    op.drop_index("ix_player_seen_launched_user", table_name="player_seen")
    op.drop_table("player_seen")

    for table, _ref in reversed(_COPIED_FROM_TABLES):
        op.drop_index(f"ix_{table}_copied_from", table_name=table)
        op.drop_constraint(f"fk_{table}_copied_from", table, type_="foreignkey")
        op.drop_column(table, "copied_from")
