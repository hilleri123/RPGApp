"""Version and journal only while a game session is active.

Revision ID: d6e7f8a9b0c1
Revises: c5d6e7f8a9b0
"""

from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import Sequence, Union

from alembic import op

revision: str = "d6e7f8a9b0c1"
down_revision: Union[str, None] = "c5d6e7f8a9b0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_SESSION_TRIGGERS = (
    ("roll_gesture", "gesture"),
    ("session_scene", "scene"),
    ("session_action", "action"),
    ("session_audio_queue", "audio_queue"),
)


def _previous():
    path = Path(__file__).with_name("c5d6e7f8a9b0_object_versions.py")
    spec = importlib.util.spec_from_file_location("object_versions_rev", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def upgrade() -> None:
    previous = _previous()
    op.execute(previous._TRIGGER)
    op.execute(previous._LOG_CHANGE)
    for table, object_type in _SESSION_TRIGGERS:
        op.execute(f'DROP TRIGGER IF EXISTS {table}_bump_version ON "{table}"')
        op.execute(
            f'CREATE TRIGGER {table}_bump_version BEFORE INSERT OR UPDATE ON "{table}" '
            f"FOR EACH ROW EXECUTE FUNCTION bump_object_version('{object_type}', 'session')"
        )


def downgrade() -> None:
    op.execute(
        """
        CREATE OR REPLACE FUNCTION bump_object_version() RETURNS trigger AS $$
        DECLARE
          new_body jsonb;
          old_body jsonb;
          obj_type text := TG_ARGV[0];
        BEGIN
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
    )
    op.execute(
        """
        CREATE OR REPLACE FUNCTION log_session_line_change() RETURNS trigger AS $$
        BEGIN
          INSERT INTO object_change(object_type, object_id, version, changed_at, op, session_id)
          VALUES ('log', NEW.id, 1, COALESCE(NEW.created_at, now()), 'updated', NEW.session_id);
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
