"""Object versions, change journal, inventory, visibility, session objects, gestures.

Revision ID: c5d6e7f8a9b0
Revises: b4c5d6e7f8a9
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c5d6e7f8a9b0"
down_revision: Union[str, None] = "b4c5d6e7f8a9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_VERSIONED = (
    "player_character",
    "npc",
    "game_item",
    "location",
    "obstacle",
    "note",
    "story_beat",
)

_TRIGGER = """
CREATE OR REPLACE FUNCTION bump_object_version() RETURNS trigger AS $$
DECLARE
  new_body jsonb;
  old_body jsonb;
  obj_type text := TG_ARGV[0];
  scope text := COALESCE(TG_ARGV[1], 'scenario');
  live boolean := false;
BEGIN
  -- Журнал и версия только у запущенной сессии. Правка сценария в редакторе молчит.
  IF scope = 'session' THEN
    SELECT EXISTS (
      SELECT 1 FROM game_session gs
      WHERE gs.id = NEW.session_id AND gs.is_active
    ) INTO live;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM game_session gs
      WHERE gs.is_active
        AND (gs.launched_scenario_id = NEW.scenario_id OR gs.scenario_id = NEW.scenario_id)
    ) INTO live;
  END IF;

  IF NOT live THEN
    IF TG_OP = 'UPDATE' THEN
      NEW.version := OLD.version;
      NEW.changed_at := OLD.changed_at;
    ELSE
      IF NEW.version IS NULL OR NEW.version < 1 THEN
        NEW.version := 1;
      END IF;
      IF NEW.changed_at IS NULL THEN
        NEW.changed_at := now();
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.version IS NULL OR NEW.version < 1 THEN
      NEW.version := 1;
    END IF;
    IF NEW.changed_at IS NULL THEN
      NEW.changed_at := now();
    END IF;
    INSERT INTO object_change(object_type, object_id, version, changed_at, op)
    VALUES (obj_type, NEW.id, NEW.version, NEW.changed_at, 'updated');
    RETURN NEW;
  END IF;

  new_body := to_jsonb(NEW) - 'version' - 'changed_at';
  old_body := to_jsonb(OLD) - 'version' - 'changed_at';
  IF new_body IS NOT DISTINCT FROM old_body THEN
    NEW.version := OLD.version;
    NEW.changed_at := OLD.changed_at;
    RETURN NEW;
  END IF;
  NEW.version := COALESCE(OLD.version, 0) + 1;
  NEW.changed_at := now();
  INSERT INTO object_change(object_type, object_id, version, changed_at, op)
  VALUES (obj_type, NEW.id, NEW.version, NEW.changed_at, 'updated');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

_TOUCH = """
CREATE OR REPLACE FUNCTION touch_inventory_membership() RETURNS trigger AS $$
DECLARE
  inv uuid;
BEGIN
  inv := COALESCE(NEW.inventory_id, OLD.inventory_id);
  UPDATE inventory SET membership_token = gen_random_uuid() WHERE id = inv;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
"""

_LOG_CHANGE = """
CREATE OR REPLACE FUNCTION log_session_line_change() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM game_session gs WHERE gs.id = NEW.session_id AND gs.is_active
  ) THEN
    RETURN NEW;
  END IF;
  INSERT INTO object_change(object_type, object_id, version, changed_at, op, session_id)
  VALUES ('log', NEW.id, 1, COALESCE(NEW.created_at, now()), 'updated', NEW.session_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""


def _add_version_columns(table: str) -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if table not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns(table)}
    if "version" not in cols:
        op.add_column(table, sa.Column("version", sa.Integer(), nullable=False, server_default="1"))
    if "changed_at" not in cols:
        op.add_column(
            table,
            sa.Column("changed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        )


def _attach_trigger(table: str, object_type: str, scope: str = "scenario") -> None:
    op.execute(f'DROP TRIGGER IF EXISTS {table}_bump_version ON "{table}"')
    op.execute(
        f'CREATE TRIGGER {table}_bump_version BEFORE INSERT OR UPDATE ON "{table}" '
        f"FOR EACH ROW EXECUTE FUNCTION bump_object_version('{object_type}', '{scope}')"
    )


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = set(insp.get_table_names())

    if "object_change" not in tables:
        op.create_table(
            "object_change",
            sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
            sa.Column("object_type", sa.String(length=64), nullable=False),
            sa.Column("object_id", sa.Uuid(), nullable=False),
            sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("changed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.Column("op", sa.String(length=16), nullable=False, server_default="updated"),
            sa.Column("session_id", sa.Uuid(), nullable=True),
        )
        op.create_index("ix_object_change_object_id", "object_change", ["object_id"])
        op.create_index("ix_object_change_session_id", "object_change", ["session_id"])

    op.execute(_TRIGGER)

    for table in _VERSIONED:
        _add_version_columns(table)
        if table in sa.inspect(bind).get_table_names():
            _attach_trigger(table, table)

    if "roll_gesture" not in tables:
        op.create_table(
            "roll_gesture",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("session_id", sa.Uuid(), sa.ForeignKey("game_session.id", ondelete="CASCADE"), nullable=True),
            sa.Column("user_id", sa.Uuid(), sa.ForeignKey("user.id", ondelete="SET NULL"), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.Column("seed_hash", sa.String(length=64), nullable=True),
            sa.Column("image_ref", sa.String(), nullable=True),
            sa.Column("reason", sa.Text(), nullable=True),
            sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("changed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        )
        op.create_index("ix_roll_gesture_session_id", "roll_gesture", ["session_id"])
        op.create_index("ix_roll_gesture_user_id", "roll_gesture", ["user_id"])
        op.create_index("ix_roll_gesture_seed_hash", "roll_gesture", ["seed_hash"])
    _attach_trigger("roll_gesture", "gesture", "session")

    if "inventory" not in tables:
        op.create_table(
            "inventory",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("scenario_id", sa.Uuid(), sa.ForeignKey("scenario.id", ondelete="CASCADE"), nullable=False),
            sa.Column("name", sa.String(), nullable=False, server_default=""),
            sa.Column("membership_token", sa.Uuid(), nullable=False),
            sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("changed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        )
        op.create_index("ix_inventory_scenario_id", "inventory", ["scenario_id"])
    _attach_trigger("inventory", "inventory")

    if "inventory_participant" not in tables:
        op.create_table(
            "inventory_participant",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("inventory_id", sa.Uuid(), sa.ForeignKey("inventory.id", ondelete="CASCADE"), nullable=False),
            sa.Column("participant_type", sa.String(length=32), nullable=False),
            sa.Column("participant_id", sa.Uuid(), nullable=False),
            sa.UniqueConstraint("inventory_id", "participant_type", "participant_id", name="uq_inventory_participant"),
        )
        op.create_index("ix_inventory_participant_inventory_id", "inventory_participant", ["inventory_id"])
        op.create_index("ix_inventory_participant_participant_id", "inventory_participant", ["participant_id"])

    if "inventory_item" not in tables:
        op.create_table(
            "inventory_item",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("inventory_id", sa.Uuid(), sa.ForeignKey("inventory.id", ondelete="CASCADE"), nullable=False),
            sa.Column("item_id", sa.Uuid(), sa.ForeignKey("game_item.id", ondelete="CASCADE"), nullable=False),
            sa.Column("qty", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("equipped", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.UniqueConstraint("item_id", name="uq_inventory_item_item"),
        )
        op.create_index("ix_inventory_item_inventory_id", "inventory_item", ["inventory_id"])

    op.execute(_TOUCH)
    for child in ("inventory_item", "inventory_participant"):
        if child in sa.inspect(bind).get_table_names() or child in ("inventory_item", "inventory_participant"):
            op.execute(f"DROP TRIGGER IF EXISTS {child}_touch_inventory ON {child}")
            op.execute(
                f"CREATE TRIGGER {child}_touch_inventory AFTER INSERT OR UPDATE OR DELETE ON {child} "
                "FOR EACH ROW EXECUTE FUNCTION touch_inventory_membership()"
            )

    if "visibility_member" not in tables:
        op.create_table(
            "visibility_member",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("session_id", sa.Uuid(), nullable=False),
            sa.Column("user_id", sa.Uuid(), nullable=False),
            sa.Column("object_type", sa.String(length=64), nullable=False),
            sa.Column("object_id", sa.Uuid(), nullable=False),
            sa.UniqueConstraint(
                "session_id", "user_id", "object_type", "object_id", name="uq_visibility_member"
            ),
        )
        op.create_index("ix_visibility_member_session_id", "visibility_member", ["session_id"])
        op.create_index("ix_visibility_member_user_id", "visibility_member", ["user_id"])
        op.create_index("ix_visibility_member_object_id", "visibility_member", ["object_id"])

    if "session_scene" not in tables:
        op.create_table(
            "session_scene",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("session_id", sa.Uuid(), sa.ForeignKey("game_session.id", ondelete="CASCADE"), nullable=False),
            sa.Column("body", sa.JSON(), nullable=False),
            sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("changed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        )
        op.create_index("ix_session_scene_session_id", "session_scene", ["session_id"])
    _attach_trigger("session_scene", "scene", "session")

    if "session_action" not in tables:
        op.create_table(
            "session_action",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("session_id", sa.Uuid(), sa.ForeignKey("game_session.id", ondelete="CASCADE"), nullable=False),
            sa.Column("body", sa.JSON(), nullable=False),
            sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("changed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        )
        op.create_index("ix_session_action_session_id", "session_action", ["session_id"])
    _attach_trigger("session_action", "action", "session")

    if "session_audio_queue" not in tables:
        op.create_table(
            "session_audio_queue",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("session_id", sa.Uuid(), sa.ForeignKey("game_session.id", ondelete="CASCADE"), nullable=False),
            sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("body", sa.JSON(), nullable=False),
            sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("changed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        )
        op.create_index("ix_session_audio_queue_session_id", "session_audio_queue", ["session_id"])
    _attach_trigger("session_audio_queue", "audio_queue", "session")

    if "session_log_line" not in tables:
        op.create_table(
            "session_log_line",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("session_id", sa.Uuid(), sa.ForeignKey("game_session.id", ondelete="CASCADE"), nullable=False),
            sa.Column("body", sa.JSON(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        )
        op.create_index("ix_session_log_line_session_id", "session_log_line", ["session_id"])
        op.create_index("ix_session_log_line_created_at", "session_log_line", ["created_at"])
    op.execute(_LOG_CHANGE)
    op.execute("DROP TRIGGER IF EXISTS session_log_line_change ON session_log_line")
    op.execute(
        "CREATE TRIGGER session_log_line_change AFTER INSERT ON session_log_line "
        "FOR EACH ROW EXECUTE FUNCTION log_session_line_change()"
    )


def downgrade() -> None:
    for table in (
        "session_log_line",
        "session_audio_queue",
        "session_action",
        "session_scene",
        "inventory_item",
        "inventory_participant",
        "roll_gesture",
        "inventory",
        *_VERSIONED,
    ):
        op.execute(f'DROP TRIGGER IF EXISTS {table}_bump_version ON "{table}"')
        op.execute(f"DROP TRIGGER IF EXISTS {table}_touch_inventory ON {table}")
    op.execute("DROP TRIGGER IF EXISTS session_log_line_change ON session_log_line")
    op.execute("DROP FUNCTION IF EXISTS log_session_line_change()")
    op.execute("DROP FUNCTION IF EXISTS touch_inventory_membership()")
    op.execute("DROP FUNCTION IF EXISTS bump_object_version()")
    for table in (
        "session_log_line",
        "session_audio_queue",
        "session_action",
        "session_scene",
        "visibility_member",
        "inventory_item",
        "inventory_participant",
        "inventory",
        "roll_gesture",
        "object_change",
    ):
        op.execute(f"DROP TABLE IF EXISTS {table}")
    for table in _VERSIONED:
        op.execute(f'ALTER TABLE "{table}" DROP COLUMN IF EXISTS version')
        op.execute(f'ALTER TABLE "{table}" DROP COLUMN IF EXISTS changed_at')
