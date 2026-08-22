"""Tests for scenario ZIP archive export/import helpers."""

from __future__ import annotations

import io
import json
import uuid
import zipfile
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services import scenario_archive as archive


def test_to_media_ref_from_public_url():
    url = f"{archive.BASE_URL}{archive.MEDIA_URL_PREFIX}/npc/icon/a.png"
    assert archive.to_media_ref(url) == "media://npc/icon/a.png"


def test_to_media_ref_from_absolute_path(tmp_path, monkeypatch):
    monkeypatch.setattr(archive, "MEDIA_ROOT", tmp_path)
    disk = tmp_path / "location" / "map" / "m.png"
    disk.parent.mkdir(parents=True)
    disk.write_bytes(b"img")
    assert archive.to_media_ref(str(disk)) == "media://location/map/m.png"


def test_media_ref_to_public_url_roundtrip():
    ref = "media://npc/icon/a.png"
    url = archive.media_ref_to_public_url(ref)
    assert url.endswith("/media/npc/icon/a.png")
    assert archive.to_media_ref(url) == ref


def test_collect_media_from_fake_graph():
    entities = [
        {
            "id": str(uuid.uuid4()),
            "icon_url": "media://npc/icon/1.png",
            "img_url": f"{archive.BASE_URL}{archive.MEDIA_URL_PREFIX}/npc/img/2.png",
        },
        {
            "id": str(uuid.uuid4()),
            "extra_images": [
                {"url": "media://location/extra/3.jpg", "path": "media://location/extra/3.jpg"},
            ],
        },
    ]
    found = archive.collect_media_from_entities(entities)
    assert found == {"npc/icon/1.png", "npc/img/2.png", "location/extra/3.jpg"}


def test_rewrite_media_fields_export_and_import(tmp_path, monkeypatch):
    monkeypatch.setattr(archive, "MEDIA_ROOT", tmp_path)
    payload = {
        "name": "Loc",
        "icon_url": f"{archive.BASE_URL}{archive.MEDIA_URL_PREFIX}/loc/icon.png",
        "icon_path": str(tmp_path / "loc" / "icon.png"),
        "extra_images": [{"url": f"{archive.BASE_URL}{archive.MEDIA_URL_PREFIX}/loc/e.png"}],
        "description": "keep",
    }
    exported = archive.rewrite_media_fields(payload, export=True)
    assert exported["icon_url"] == "media://loc/icon.png"
    assert exported["icon_path"] == "media://loc/icon.png"
    assert exported["extra_images"][0]["url"] == "media://loc/e.png"
    assert exported["description"] == "keep"

    imported = archive.rewrite_media_fields(exported, export=False)
    assert imported["icon_url"].endswith("/media/loc/icon.png")
    assert imported["icon_path"] == str(tmp_path / "loc" / "icon.png")


@pytest.mark.asyncio
async def test_export_missing_media_warns_but_builds_zip(tmp_path, monkeypatch):
    monkeypatch.setattr(archive, "MEDIA_ROOT", tmp_path)

    scenario_id = uuid.uuid4()
    user_id = uuid.uuid4()
    src = MagicMock()
    src.id = scenario_id
    src.name = "Test"
    src.intro = None
    src.max_players = 4
    src.created = None
    src.rule_id_str = "pbta"
    src.icon_url = f"{archive.BASE_URL}{archive.MEDIA_URL_PREFIX}/scenario/missing.png"
    src.data = {}
    src.tags = None
    src.scenario_starts_at = None
    src.locations = []
    src.story_beats = []
    src.characters = []
    src.npcs = []
    src.items = []
    src.notes = []
    src.counters = []
    src.obstacles = []
    src.todos = []
    src.entity_pack_links = []

    # columns for _row_to_dict
    from app.models.scenario.scenario import Scenario

    for col in Scenario.__table__.columns:
        if not hasattr(src, col.name):
            setattr(src, col.name, None)

    result = MagicMock()
    result.scalars.return_value.first.return_value = src
    db = AsyncMock()
    db.execute = AsyncMock(return_value=result)

    # template entity links query
    empty = MagicMock()
    empty.scalars.return_value.all.return_value = []
    empty.scalars.return_value.first.return_value = src

    async def execute_side_effect(stmt):
        # first call loads scenario
        return result

    db.execute = AsyncMock(side_effect=execute_side_effect)

    with patch.object(archive, "_scenario_load_stmt", return_value=MagicMock()):
        # second execute for template links - rebuild to always return src then empty lists
        call_count = {"n": 0}

        async def exec2(stmt):
            call_count["n"] += 1
            if call_count["n"] == 1:
                return result
            return empty

        db.execute = AsyncMock(side_effect=exec2)
        json_files, media_bytes, warnings = await archive.build_archive_payload(db, scenario_id)

    assert any("missing media file: scenario/missing.png" in w for w in warnings)
    assert media_bytes == {}
    assert json_files["manifest.json"]["format_version"] == 1
    assert json_files["manifest.json"]["root_scenario_id"] == scenario_id

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        for name, payload in json_files.items():
            zf.writestr(name, archive.dumps(payload))
    buf.seek(0)
    with zipfile.ZipFile(buf, "r") as zf:
        assert "manifest.json" in zf.namelist()
        assert "scenario.json" in zf.namelist()


@pytest.mark.asyncio
async def test_import_skips_when_scenario_exists(tmp_path, monkeypatch):
    monkeypatch.setattr(archive, "MEDIA_ROOT", tmp_path)
    scenario_id = uuid.uuid4()

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr(
            "manifest.json",
            archive.dumps(
                {
                    "format_version": 1,
                    "root_scenario_id": str(scenario_id),
                    "rule_id_str": "pbta",
                    "files": [],
                    "media": [],
                    "warnings": [],
                }
            ),
        )
        zf.writestr(
            "scenario.json",
            archive.dumps({"id": str(scenario_id), "name": "X", "rule_id_str": "pbta"}),
        )
    zip_bytes = buf.getvalue()

    db = AsyncMock()
    db.get = AsyncMock(return_value=MagicMock())  # scenario exists

    report = await archive.import_scenario_archive(
        db, zip_bytes, owner_user_id=uuid.uuid4()
    )
    assert report.imported is False
    assert report.reason == "scenario_exists"
    assert report.id == scenario_id
    db.add.assert_not_called()


@pytest.mark.asyncio
async def test_import_creates_scenario_and_media(tmp_path, monkeypatch):
    monkeypatch.setattr(archive, "MEDIA_ROOT", tmp_path)
    scenario_id = uuid.uuid4()
    owner_id = uuid.uuid4()
    npc_id = uuid.uuid4()

    media_rel = "npc/icon/demo.png"
    media_content = b"png-bytes"

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr(
            "manifest.json",
            archive.dumps(
                {
                    "format_version": 1,
                    "root_scenario_id": str(scenario_id),
                    "rule_id_str": "pbta",
                    "files": ["scenario.json", "npcs.json"],
                    "media": [{"path": media_rel, "sha256": "x", "size": len(media_content)}],
                    "warnings": [],
                }
            ),
        )
        zf.writestr(
            "scenario.json",
            archive.dumps(
                {
                    "id": str(scenario_id),
                    "name": "Imported",
                    "rule_id_str": "pbta",
                    "icon_url": "media://scenario/icon.png",
                    "data": {"custom": 1},
                    "tags": [],
                }
            ),
        )
        zf.writestr(
            "npcs.json",
            archive.dumps(
                [
                    {
                        "id": str(npc_id),
                        "name": "Goblin",
                        "scenario_id": str(scenario_id),
                        "icon_url": f"media://{media_rel}",
                        "data": {},
                        "tags": [],
                    }
                ]
            ),
        )
        for empty in (
            "locations.json",
            "map_polygons.json",
            "items.json",
            "characters.json",
            "item_ownership.json",
            "story_beats.json",
            "story_beat_links.json",
            "scene_exposures.json",
            "scene_exposure_links.json",
            "obstacles.json",
            "notes.json",
            "counters.json",
            "todos.json",
            "audio_tracks.json",
        ):
            zf.writestr(empty, b"[]")
        zf.writestr("entity_packs.json", b"{}")
        zf.writestr(f"media/{media_rel}", media_content)

    zip_bytes = buf.getvalue()

    existing: dict[tuple, object] = {}

    async def get_side_effect(model, ident):
        key = (model, ident if not isinstance(ident, tuple) else ident)
        return existing.get(key)

    def add_side_effect(obj):
        existing[(type(obj), obj.id)] = obj

    db = AsyncMock()
    db.get = AsyncMock(side_effect=get_side_effect)
    db.add = MagicMock(side_effect=add_side_effect)
    db.flush = AsyncMock()
    db.execute = AsyncMock(return_value=MagicMock(first=MagicMock(return_value=None)))

    with patch("app.plugins.registry_singleton.registry") as reg:
        reg.get.side_effect = KeyError("missing")
        report = await archive.import_scenario_archive(db, zip_bytes, owner_user_id=owner_id)

    assert report.imported is True
    assert report.created.get("scenario") == 1
    assert report.created.get("npcs") == 1
    assert report.created.get("media_files") == 1
    assert any("rule plugin not found" in w for w in report.warnings)

    dest = tmp_path / media_rel
    assert dest.is_file()
    assert dest.read_bytes() == media_content

    # second import → scenario_exists
    from app import models as app_models

    existing.clear()
    existing[(app_models.Scenario, scenario_id)] = MagicMock()
    report2 = await archive.import_scenario_archive(db, zip_bytes, owner_user_id=owner_id)
    assert report2.imported is False
    assert report2.reason == "scenario_exists"


@pytest.mark.asyncio
async def test_unsupported_format_version():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr(
            "manifest.json",
            archive.dumps(
                {
                    "format_version": 99,
                    "root_scenario_id": str(uuid.uuid4()),
                }
            ),
        )
        zf.writestr("scenario.json", b"{}")

    db = AsyncMock()
    db.get = AsyncMock(return_value=None)
    with pytest.raises(archive.ArchiveFormatError, match="format_version"):
        await archive.import_scenario_archive(db, buf.getvalue(), owner_user_id=uuid.uuid4())
