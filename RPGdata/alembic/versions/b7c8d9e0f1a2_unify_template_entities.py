"""Unify template entities into npc/game_item/player_character + entity packs.

Revision ID: b7c8d9e0f1a2
Revises: a1b2c3d4e5f6
"""

from __future__ import annotations

import json
import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b7c8d9e0f1a2"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TEMPLATE_TAG = "template"


def _ensure_template_tag(tags_raw) -> str:
    tags = list(tags_raw or [])
    tags = [str(t) for t in tags]
    if TEMPLATE_TAG not in tags:
        tags.append(TEMPLATE_TAG)
    return json.dumps(tags)


def _json_col(val):
    if val is None:
        return None
    if isinstance(val, (dict, list)):
        return json.dumps(val)
    return val


def upgrade() -> None:
    # --- nullable scenario_id on main entity tables ---
    op.alter_column("npc", "scenario_id", existing_type=sa.Uuid(), nullable=True)
    op.alter_column("game_item", "scenario_id", existing_type=sa.Uuid(), nullable=True)
    op.alter_column("player_character", "scenario_id", existing_type=sa.Uuid(), nullable=True)

    # --- new pack tables ---
    op.create_table(
        "entity_pack",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("rule_id_str", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_entity_pack_id", "entity_pack", ["id"])
    op.create_index("ix_entity_pack_rule_id_str", "entity_pack", ["rule_id_str"])

    op.create_table(
        "entity_pack_member",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("pack_id", sa.Uuid(), nullable=False),
        sa.Column("entity_kind", sa.String(), nullable=False),
        sa.Column("entity_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["pack_id"], ["entity_pack.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("pack_id", "entity_kind", "entity_id", name="uq_entity_pack_member"),
    )
    op.create_index("ix_entity_pack_member_pack_id", "entity_pack_member", ["pack_id"])
    op.create_index("ix_entity_pack_member_entity_kind", "entity_pack_member", ["entity_kind"])
    op.create_index("ix_entity_pack_member_entity_id", "entity_pack_member", ["entity_id"])

    op.create_table(
        "scenario_entity_pack_link",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("scenario_id", sa.Uuid(), nullable=False),
        sa.Column("pack_id", sa.Uuid(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("order_num", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("tags", sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(["scenario_id"], ["scenario.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["pack_id"], ["entity_pack.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("scenario_id", "pack_id", name="uq_scenario_entity_pack_link"),
    )
    op.create_index("ix_scenario_entity_pack_link_scenario_id", "scenario_entity_pack_link", ["scenario_id"])
    op.create_index("ix_scenario_entity_pack_link_pack_id", "scenario_entity_pack_link", ["pack_id"])

    op.create_table(
        "scenario_template_entity_link",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("scenario_id", sa.Uuid(), nullable=False),
        sa.Column("entity_kind", sa.String(), nullable=False),
        sa.Column("entity_id", sa.Uuid(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("order_num", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["scenario_id"], ["scenario.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "scenario_id", "entity_kind", "entity_id", name="uq_scenario_template_entity_link"
        ),
    )
    op.create_index(
        "ix_scenario_template_entity_link_scenario_id", "scenario_template_entity_link", ["scenario_id"]
    )
    op.create_index(
        "ix_scenario_template_entity_link_entity_kind", "scenario_template_entity_link", ["entity_kind"]
    )
    op.create_index(
        "ix_scenario_template_entity_link_entity_id", "scenario_template_entity_link", ["entity_id"]
    )

    conn = op.get_bind()

    # --- migrate rule_template_set -> entity_pack ---
    conn.execute(
        sa.text(
            """
            INSERT INTO entity_pack (id, rule_id_str, name)
            SELECT id, rule_id_str, name FROM rule_template_set
            """
        )
    )

    # scenario-owned packs -> auto-link
    conn.execute(
        sa.text(
            """
            INSERT INTO scenario_entity_pack_link (id, scenario_id, pack_id, enabled, order_num)
            SELECT gen_random_uuid(), scenario_id, id, true, 0
            FROM rule_template_set
            WHERE scenario_id IS NOT NULL
            """
        )
    )

    # existing cross-scenario links
    conn.execute(
        sa.text(
            """
            INSERT INTO scenario_entity_pack_link (id, scenario_id, pack_id, enabled, order_num, tags)
            SELECT id, scenario_id, template_set_id, enabled, order_num, tags
            FROM scenario_template_set_link
            ON CONFLICT (scenario_id, pack_id) DO NOTHING
            """
        )
    )

    # --- migrate template entities (preserve ids) ---
    npc_rows = conn.execute(sa.text("SELECT * FROM rule_npc_template")).mappings().all()
    for row in npc_rows:
        conn.execute(
            sa.text(
                """
                INSERT INTO npc (
                    id, name, description_for_master, description_for_players,
                    data, tags, icon_url, img_url, scenario_id
                ) VALUES (
                    :id, :name, :description_for_master, :description_for_players,
                    CAST(:data AS json), CAST(:tags AS json), :icon_url, :img_url, NULL
                )
                ON CONFLICT (id) DO NOTHING
                """
            ),
            {
                "id": row["id"],
                "name": row["name"],
                "description_for_master": row.get("description_for_master"),
                "description_for_players": row.get("description_for_players"),
                "data": _json_col(row.get("data")),
                "tags": _ensure_template_tag(row.get("tags")),
                "icon_url": row.get("icon_url"),
                "img_url": row.get("img_url"),
            },
        )
        conn.execute(
            sa.text(
                """
                INSERT INTO entity_pack_member (id, pack_id, entity_kind, entity_id)
                VALUES (gen_random_uuid(), :pack_id, 'npc', :entity_id)
                ON CONFLICT (pack_id, entity_kind, entity_id) DO NOTHING
                """
            ),
            {"pack_id": row["template_set_id"], "entity_id": row["id"]},
        )

    item_rows = conn.execute(sa.text("SELECT * FROM rule_item_template")).mappings().all()
    for row in item_rows:
        conn.execute(
            sa.text(
                """
                INSERT INTO game_item (
                    id, name, description_for_master, description_for_players,
                    icon_url, img_url, data, tags, quest_html_mark, scenario_id
                ) VALUES (
                    :id, :name, :description_for_master, :description_for_players,
                    :icon_url, :img_url, CAST(:data AS json), CAST(:tags AS json),
                    :quest_html_mark, NULL
                )
                ON CONFLICT (id) DO NOTHING
                """
            ),
            {
                "id": row["id"],
                "name": row["name"],
                "description_for_master": row.get("description_for_master"),
                "description_for_players": row.get("description_for_players"),
                "icon_url": row.get("icon_url"),
                "img_url": row.get("img_url"),
                "data": _json_col(row.get("data")),
                "tags": _ensure_template_tag(row.get("tags")),
                "quest_html_mark": row.get("quest_html_mark"),
            },
        )
        conn.execute(
            sa.text(
                """
                INSERT INTO entity_pack_member (id, pack_id, entity_kind, entity_id)
                VALUES (gen_random_uuid(), :pack_id, 'game_item', :entity_id)
                ON CONFLICT (pack_id, entity_kind, entity_id) DO NOTHING
                """
            ),
            {"pack_id": row["template_set_id"], "entity_id": row["id"]},
        )

    char_rows = conn.execute(sa.text("SELECT * FROM rule_character_template")).mappings().all()
    for row in char_rows:
        conn.execute(
            sa.text(
                """
                INSERT INTO player_character (
                    id, name, short_desc, story, data, tags,
                    icon_url, img_url, scenario_id
                ) VALUES (
                    :id, :name, :short_desc, :story, CAST(:data AS json), CAST(:tags AS json),
                    :icon_url, :img_url, NULL
                )
                ON CONFLICT (id) DO NOTHING
                """
            ),
            {
                "id": row["id"],
                "name": row["name"],
                "short_desc": row.get("short_desc"),
                "story": row.get("story"),
                "data": _json_col(row.get("data")),
                "tags": _ensure_template_tag(row.get("tags")),
                "icon_url": row.get("icon_url"),
                "img_url": row.get("img_url"),
            },
        )
        conn.execute(
            sa.text(
                """
                INSERT INTO entity_pack_member (id, pack_id, entity_kind, entity_id)
                VALUES (gen_random_uuid(), :pack_id, 'player_character', :entity_id)
                ON CONFLICT (pack_id, entity_kind, entity_id) DO NOTHING
                """
            ),
            {"pack_id": row["template_set_id"], "entity_id": row["id"]},
        )

    # ownership templates -> item_ownership
    own_rows = conn.execute(sa.text("SELECT * FROM rule_item_ownership_template")).mappings().all()
    for row in own_rows:
        char_id = row.get("character_template_id")
        npc_id = row.get("npc_template_id")
        owner_item_id = row.get("owner_item_template_id")
        if char_id:
            owner_item_id = None
        elif npc_id:
            owner_item_id = None
        conn.execute(
            sa.text(
                """
                INSERT INTO item_ownership (
                    id, item_id, character_id, npc_id, owner_item_id, qty, equipped
                ) VALUES (
                    :id, :item_id, :character_id, :npc_id, :owner_item_id, :qty, :equipped
                )
                ON CONFLICT (item_id) DO NOTHING
                """
            ),
            {
                "id": row["id"],
                "item_id": row["item_template_id"],
                "character_id": char_id,
                "npc_id": npc_id,
                "owner_item_id": owner_item_id,
                "qty": row.get("qty") or 1,
                "equipped": row.get("equipped") or False,
            },
        )

    contained_rows = conn.execute(sa.text("SELECT * FROM rule_item_contained_template")).mappings().all()
    for row in contained_rows:
        conn.execute(
            sa.text(
                """
                INSERT INTO item_ownership (
                    id, item_id, character_id, npc_id, owner_item_id, qty, equipped
                ) VALUES (
                    gen_random_uuid(), :item_id, NULL, NULL, :owner_item_id, :qty, false
                )
                ON CONFLICT (item_id) DO NOTHING
                """
            ),
            {
                "item_id": row["item_template_id"],
                "owner_item_id": row["owner_item_template_id"],
                "qty": row.get("qty") or 1,
            },
        )

    # scene exposure FK: rule_npc_template -> npc, rule_item_template -> game_item
    op.drop_constraint(
        "application_item_request_requested_item_id_fkey",
        "application_item_request",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "application_item_request_requested_item_id_fkey",
        "application_item_request",
        "game_item",
        ["requested_item_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.drop_constraint(
        "scene_exposure_template_npc_template_npc_id_fkey",
        "scene_exposure_template_npc",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "scene_exposure_template_npc_template_npc_id_fkey",
        "scene_exposure_template_npc",
        "npc",
        ["template_npc_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.drop_constraint(
        "scene_exposure_template_item_template_item_id_fkey",
        "scene_exposure_template_item",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "scene_exposure_template_item_template_item_id_fkey",
        "scene_exposure_template_item",
        "game_item",
        ["template_item_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # drop legacy template tables
    op.drop_table("rule_item_contained_template")
    op.drop_table("rule_item_ownership_template")
    op.drop_table("rule_npc_template")
    op.drop_table("rule_item_template")
    op.drop_table("rule_character_template")
    op.drop_table("scenario_template_set_link")
    op.drop_table("rule_template_set")


def downgrade() -> None:
    raise NotImplementedError("Downgrade not supported for template unification migration")
