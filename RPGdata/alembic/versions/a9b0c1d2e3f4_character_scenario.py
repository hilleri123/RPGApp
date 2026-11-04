"""Character membership in many scenarios.

Revision ID: a9b0c1d2e3f4
Revises: f8a9b0c1d2e3
"""

from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a9b0c1d2e3f4"
down_revision: Union[str, None] = "f8a9b0c1d2e3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TRIGGER = """
CREATE OR REPLACE FUNCTION bump_object_version() RETURNS trigger AS $$
DECLARE
  new_body jsonb;
  old_body jsonb;
  obj_type text := TG_ARGV[0];
  scope text := COALESCE(TG_ARGV[1], 'scenario');
  live boolean := false;
BEGIN
  IF scope = 'session' THEN
    SELECT EXISTS (
      SELECT 1 FROM game_session gs
      WHERE gs.id = NEW.session_id AND gs.is_active
    ) INTO live;
  ELSIF scope = 'character' THEN
    SELECT EXISTS (
      SELECT 1 FROM character_scenario cs
      JOIN game_session gs ON gs.is_active
        AND (gs.launched_scenario_id = cs.scenario_id OR gs.scenario_id = cs.scenario_id)
      WHERE cs.character_id = NEW.id
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

_DELETE_EXCLUSIVE = """
CREATE OR REPLACE FUNCTION delete_exclusive_native_characters() RETURNS trigger AS $$
BEGIN
  DELETE FROM player_character pc
  WHERE pc.id IN (
    SELECT cs.character_id
    FROM character_scenario cs
    WHERE cs.scenario_id = OLD.id
      AND cs.origin = 'native'
      AND NOT EXISTS (
        SELECT 1 FROM character_scenario other
        WHERE other.character_id = cs.character_id
          AND other.scenario_id <> OLD.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM character_application app
        WHERE app.player_character_id = cs.character_id
      )
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
"""


def _versions_module():
    path = Path(__file__).with_name("c5d6e7f8a9b0_object_versions.py")
    spec = importlib.util.spec_from_file_location("object_versions_rev", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def upgrade() -> None:
    op.create_table(
        "character_scenario",
        sa.Column("character_id", sa.Uuid(), nullable=False),
        sa.Column("scenario_id", sa.Uuid(), nullable=False),
        sa.Column("origin", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["character_id"], ["player_character.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["scenario_id"], ["scenario.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("character_id", "scenario_id"),
    )
    op.create_index("ix_character_scenario_scenario_id", "character_scenario", ["scenario_id"])

    op.execute(
        """
        INSERT INTO character_scenario (character_id, scenario_id, origin)
        SELECT pc.id, pc.scenario_id,
          CASE
            WHEN EXISTS (
              SELECT 1 FROM character_application app
              WHERE app.player_character_id = pc.id
            )
            AND pc.source_entity_id IS NULL
            AND pc.copied_from IS NULL
            THEN 'application'
            ELSE 'native'
          END
        FROM player_character pc
        WHERE pc.scenario_id IS NOT NULL
        """
    )

    op.execute(_TRIGGER)
    op.execute('DROP TRIGGER IF EXISTS player_character_bump_version ON "player_character"')
    op.execute(
        "CREATE TRIGGER player_character_bump_version BEFORE INSERT OR UPDATE ON \"player_character\" "
        "FOR EACH ROW EXECUTE FUNCTION bump_object_version('player_character', 'character')"
    )
    op.execute(_DELETE_EXCLUSIVE)
    op.execute(
        "CREATE TRIGGER scenario_delete_exclusive_characters BEFORE DELETE ON scenario "
        "FOR EACH ROW EXECUTE FUNCTION delete_exclusive_native_characters()"
    )

    bind = op.get_bind()
    insp = sa.inspect(bind)
    for fk in insp.get_foreign_keys("player_character"):
        if fk.get("constrained_columns") == ["scenario_id"] and fk.get("name"):
            op.drop_constraint(fk["name"], "player_character", type_="foreignkey")
    op.drop_column("player_character", "scenario_id")


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS scenario_delete_exclusive_characters ON scenario")
    op.execute("DROP FUNCTION IF EXISTS delete_exclusive_native_characters()")

    op.add_column("player_character", sa.Column("scenario_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "player_character_scenario_id_fkey",
        "player_character",
        "scenario",
        ["scenario_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.execute(
        """
        UPDATE player_character pc
        SET scenario_id = picked.scenario_id
        FROM (
          SELECT DISTINCT ON (character_id) character_id, scenario_id
          FROM character_scenario
          ORDER BY character_id, CASE origin WHEN 'native' THEN 0 ELSE 1 END, scenario_id
        ) picked
        WHERE pc.id = picked.character_id
        """
    )
    op.drop_index("ix_character_scenario_scenario_id", table_name="character_scenario")
    op.drop_table("character_scenario")

    previous = _versions_module()
    op.execute(previous._TRIGGER)
    op.execute('DROP TRIGGER IF EXISTS player_character_bump_version ON "player_character"')
    op.execute(
        "CREATE TRIGGER player_character_bump_version BEFORE INSERT OR UPDATE ON \"player_character\" "
        "FOR EACH ROW EXECUTE FUNCTION bump_object_version('player_character')"
    )
