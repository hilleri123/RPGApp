"""Application references player_character; migrate granted items to item_ownership.

Revision ID: j9k0l1m2n3o4
Revises: i9j0k1l2m3n4
"""

from __future__ import annotations

import json
import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "j9k0l1m2n3o4"
down_revision: Union[str, None] = "i9j0k1l2m3n4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _json_val(val):
    if val is None:
        return None
    if isinstance(val, (dict, list)):
        return json.dumps(val)
    return val


def upgrade() -> None:
    op.add_column(
        "character_application",
        sa.Column("player_character_id", sa.Uuid(), nullable=True),
    )
    op.create_index(
        "ix_character_application_player_character_id",
        "character_application",
        ["player_character_id"],
        unique=True,
    )
    op.create_foreign_key(
        "fk_character_application_player_character_id",
        "character_application",
        "player_character",
        ["player_character_id"],
        ["id"],
        ondelete="SET NULL",
    )

    conn = op.get_bind()

    apps = conn.execute(
        sa.text(
            """
            SELECT id, name, short_desc, story, tags, data,
                   icon_url, icon_path, img_url, img_path
            FROM character_application
            WHERE player_character_id IS NULL
            """
        )
    ).fetchall()

    for app in apps:
        pc_id = uuid.uuid4()
        conn.execute(
            sa.text(
                """
                INSERT INTO player_character (
                    id, name, short_desc, story, tags, data,
                    icon_url, icon_path, img_url, img_path, scenario_id
                ) VALUES (
                    :id, :name, :short_desc, :story, :tags, :data,
                    :icon_url, :icon_path, :img_url, :img_path, NULL
                )
                """
            ),
            {
                "id": pc_id,
                "name": app.name,
                "short_desc": app.short_desc,
                "story": app.story,
                "tags": _json_val(app.tags),
                "data": _json_val(app.data),
                "icon_url": app.icon_url,
                "icon_path": app.icon_path,
                "img_url": app.img_url,
                "img_path": app.img_path,
            },
        )
        conn.execute(
            sa.text(
                """
                UPDATE character_application
                SET player_character_id = :pc_id
                WHERE id = :app_id
                """
            ),
            {"pc_id": pc_id, "app_id": app.id},
        )

        grants = conn.execute(
            sa.text(
                """
                SELECT item_id
                FROM character_application_item
                WHERE application_id = :app_id
                """
            ),
            {"app_id": app.id},
        ).fetchall()

        for grant in grants:
            exists = conn.execute(
                sa.text(
                    """
                    SELECT 1 FROM item_ownership
                    WHERE character_id = :pc_id AND item_id = :item_id
                    LIMIT 1
                    """
                ),
                {"pc_id": pc_id, "item_id": grant.item_id},
            ).first()
            if exists:
                continue
            conn.execute(
                sa.text(
                    """
                    INSERT INTO item_ownership (id, character_id, item_id, qty, equipped)
                    VALUES (:id, :pc_id, :item_id, 1, false)
                    """
                ),
                {"id": uuid.uuid4(), "pc_id": pc_id, "item_id": grant.item_id},
            )


def downgrade() -> None:
    op.drop_constraint(
        "fk_character_application_player_character_id",
        "character_application",
        type_="foreignkey",
    )
    op.drop_index("ix_character_application_player_character_id", table_name="character_application")
    op.drop_column("character_application", "player_character_id")
