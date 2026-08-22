"""Scenario ZIP archive export/import (self-contained JSON + media)."""

from __future__ import annotations

import hashlib
import io
import json
import zipfile
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Iterable
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app import models
from app.infrastructure.s3_service import BASE_URL, MEDIA_ROOT, MEDIA_URL_PREFIX
from app.models.scenario.scene_exposure import (
    scene_exposure_item,
    scene_exposure_npc,
    scene_exposure_obstacle,
)
from app.models.scenario.story_beat import story_beat_location, story_beat_npc
from app.services.scenario_cloner import _scenario_load_stmt

FORMAT_VERSION = 1
MEDIA_SCHEME = "media://"

SCENARIO_EXCLUDE = frozenset(
    {
        "user_id",
        "is_session_snapshot",
        "lifecycle_status",
        "launch_mode",
        "source_scenario_id",
    }
)

URL_FIELDS = frozenset({"icon_url", "img_url", "map_url", "url"})
PATH_FIELDS = frozenset({"icon_path", "img_path", "image_map_path", "sh3d_map_path"})


class ArchiveFormatError(ValueError):
    """Unsupported or corrupt archive."""


class SoftModel(BaseModel):
    model_config = ConfigDict(extra="ignore")


class ManifestV1(SoftModel):
    format_version: int
    exported_at: str | None = None
    rule_id_str: str | None = None
    root_scenario_id: UUID
    app_hint: str | None = None
    files: list[str] = Field(default_factory=list)
    media: list[dict[str, Any]] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


@dataclass
class ImportReport:
    imported: bool
    reason: str | None = None
    id: UUID | None = None
    created: dict[str, int] = field(default_factory=dict)
    skipped: dict[str, int] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)

    def bump(self, bucket: dict[str, int], key: str, n: int = 1) -> None:
        bucket[key] = bucket.get(key, 0) + n

    def to_dict(self) -> dict[str, Any]:
        return {
            "imported": self.imported,
            "reason": self.reason,
            "id": str(self.id) if self.id else None,
            "created": self.created,
            "skipped": self.skipped,
            "warnings": self.warnings,
        }


def json_default(obj: Any) -> Any:
    if isinstance(obj, UUID):
        return str(obj)
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, Enum):
        return obj.value
    if isinstance(obj, Path):
        return str(obj)
    raise TypeError(f"Object of type {type(obj)!r} is not JSON serializable")


def dumps(data: Any) -> bytes:
    return json.dumps(data, ensure_ascii=False, indent=2, default=json_default).encode("utf-8")


def loads(raw: bytes | str) -> Any:
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8")
    return json.loads(raw)


# ---------------------------------------------------------------------------
# Media path helpers
# ---------------------------------------------------------------------------


def relative_from_media_root(path_str: str | None) -> str | None:
    if not path_str:
        return None
    text = str(path_str).strip()
    if not text:
        return None
    if text.startswith(MEDIA_SCHEME):
        return text[len(MEDIA_SCHEME) :].lstrip("/")

    marker = MEDIA_URL_PREFIX.rstrip("/") + "/"
    idx = text.find(marker)
    if idx != -1:
        return text[idx + len(marker) :].lstrip("/")

    try:
        path = Path(text)
        if path.is_absolute():
            try:
                return path.resolve().relative_to(MEDIA_ROOT.resolve()).as_posix()
            except (ValueError, OSError):
                pass
        if "/" in text or "." in Path(text).suffix:
            candidate = (MEDIA_ROOT / text).resolve()
            try:
                return candidate.relative_to(MEDIA_ROOT.resolve()).as_posix()
            except (ValueError, OSError):
                return text.lstrip("/")
    except OSError:
        return text.lstrip("/")
    return None


def to_media_ref(value: str | None) -> str | None:
    rel = relative_from_media_root(value)
    if rel is None:
        return value
    return f"{MEDIA_SCHEME}{rel}"


def media_ref_to_public_url(value: str | None) -> str | None:
    if value is None:
        return None
    rel = relative_from_media_root(value)
    if rel is None:
        return value
    return f"{BASE_URL}{MEDIA_URL_PREFIX}/{rel}"


def media_ref_to_disk_path(value: str | None) -> str | None:
    if value is None:
        return None
    rel = relative_from_media_root(value)
    if rel is None:
        return value
    return str(MEDIA_ROOT / rel)


def rewrite_media_fields(payload: dict[str, Any], *, export: bool) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key, value in payload.items():
        if key in URL_FIELDS and isinstance(value, str):
            out[key] = to_media_ref(value) if export else media_ref_to_public_url(value)
        elif key in PATH_FIELDS and isinstance(value, str):
            out[key] = to_media_ref(value) if export else media_ref_to_disk_path(value)
        elif key == "extra_images" and isinstance(value, list):
            images = []
            for img in value:
                if not isinstance(img, dict):
                    images.append(img)
                    continue
                item = dict(img)
                if isinstance(item.get("url"), str):
                    item["url"] = (
                        to_media_ref(item["url"]) if export else media_ref_to_public_url(item["url"])
                    )
                if isinstance(item.get("path"), str):
                    item["path"] = (
                        to_media_ref(item["path"]) if export else media_ref_to_disk_path(item["path"])
                    )
                images.append(item)
            out[key] = images
        else:
            out[key] = value
    return out


def collect_media_refs_from_value(value: Any, out: set[str]) -> None:
    if isinstance(value, str):
        rel = relative_from_media_root(value)
        if rel:
            out.add(rel)
    elif isinstance(value, dict):
        for v in value.values():
            collect_media_refs_from_value(v, out)
    elif isinstance(value, list):
        for v in value:
            collect_media_refs_from_value(v, out)


def collect_media_from_entities(entities: Iterable[dict[str, Any]]) -> set[str]:
    found: set[str] = set()
    for ent in entities:
        for key, value in ent.items():
            if key in URL_FIELDS or key in PATH_FIELDS or key in {"extra_images", "url"}:
                collect_media_refs_from_value(value, found)
    return found


# ---------------------------------------------------------------------------
# Serialization helpers
# ---------------------------------------------------------------------------


def _row_to_dict(
    obj: Any,
    model_cls: type,
    *,
    exclude: frozenset[str] = frozenset(),
) -> dict[str, Any]:
    cols = {c.name for c in model_cls.__table__.columns}
    data: dict[str, Any] = {}
    for name in cols:
        if name in exclude:
            continue
        value = getattr(obj, name)
        if isinstance(value, Enum):
            value = value.value
        data[name] = value
    return rewrite_media_fields(data, export=True)


def _parse_uuid(value: Any) -> UUID | None:
    if value is None or value == "":
        return None
    if isinstance(value, UUID):
        return value
    return UUID(str(value))


def _parse_dt(value: Any) -> datetime | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value
    text = str(value)
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    return datetime.fromisoformat(text)


def _prepare_entity(raw: dict[str, Any], *, exclude: frozenset[str] = frozenset()) -> dict[str, Any]:
    data = {k: v for k, v in raw.items() if k not in exclude and k != "id"}
    return rewrite_media_fields(data, export=False)


def _filter_columns(model_cls: type, data: dict[str, Any]) -> dict[str, Any]:
    cols = {c.name for c in model_cls.__table__.columns} - {"id"}
    out: dict[str, Any] = {}
    for k, v in data.items():
        if k not in cols:
            continue
        if k.endswith("_id"):
            out[k] = _parse_uuid(v) if v is not None else None
        elif k in {
            "created",
            "done_at",
            "created_at",
            "updated_at",
            "scenario_starts_at",
        }:
            out[k] = _parse_dt(v) if isinstance(v, str) else v
        else:
            out[k] = v
    return out


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------


async def build_archive_payload(
    db: AsyncSession,
    scenario_id: UUID,
) -> tuple[dict[str, Any], dict[str, bytes], list[str]]:
    """Return (json_files, media_rel->bytes, warnings)."""
    warnings: list[str] = []
    src: models.Scenario | None = (
        await db.execute(_scenario_load_stmt(scenario_id))
    ).scalars().first()
    if not src:
        raise ValueError(f"scenario not found: {scenario_id}")

    scenario = _row_to_dict(src, models.Scenario, exclude=SCENARIO_EXCLUDE)
    locations = [_row_to_dict(loc, models.Location) for loc in (src.locations or [])]
    map_polygons: list[dict[str, Any]] = []
    for loc in src.locations or []:
        for mo in loc.map_objects or []:
            map_polygons.append(_row_to_dict(mo, models.MapObjectPolygon))

    npcs = [_row_to_dict(n, models.NPC) for n in (src.npcs or [])]
    items = [_row_to_dict(i, models.GameItem) for i in (src.items or [])]
    characters = [_row_to_dict(c, models.PlayerCharacter) for c in (src.characters or [])]

    ownership_seen: set[UUID] = set()
    item_ownership: list[dict[str, Any]] = []

    def _add_ownership(link: models.ItemOwnership) -> None:
        if link.id in ownership_seen:
            return
        ownership_seen.add(link.id)
        item_ownership.append(_row_to_dict(link, models.ItemOwnership))

    for owner in list(src.npcs or []) + list(src.characters or []):
        for link in getattr(owner, "owned_item_links", None) or []:
            _add_ownership(link)
    for item in src.items or []:
        if item.ownership_link:
            _add_ownership(item.ownership_link)
        for link in item.contained_item_links or []:
            _add_ownership(link)

    story_beats = [_row_to_dict(sb, models.StoryBeat) for sb in (src.story_beats or [])]
    story_beat_links = [
        {
            "story_beat_id": sb.id,
            "location_ids": [loc.id for loc in (sb.locations or [])],
            "npc_ids": [n.id for n in (sb.npcs or [])],
        }
        for sb in (src.story_beats or [])
    ]

    exposures: list[models.SceneExposure] = []
    for loc in src.locations or []:
        exposures.extend(loc.scene_exposures or [])
    for sb in src.story_beats or []:
        exposures.extend(sb.scene_exposures or [])

    scene_exposures = [_row_to_dict(se, models.SceneExposure) for se in exposures]
    scene_exposure_links: list[dict[str, Any]] = []
    audio_ids: set[UUID] = set()
    for se in exposures:
        for al in se.audio_tracks or []:
            audio_ids.add(al.audio_track_id)
        scene_exposure_links.append(
            {
                "scene_exposure_id": se.id,
                "npc_ids": [n.id for n in (se.npcs or [])],
                "item_ids": [i.id for i in (se.items or [])],
                "obstacle_ids": [o.id for o in (se.obstacles or [])],
                "template_npcs": [
                    {
                        "id": link.id,
                        "template_npc_id": link.template_npc_id,
                        "qty": link.qty,
                    }
                    for link in (se.template_npc_links or [])
                ],
                "template_items": [
                    {
                        "id": link.id,
                        "template_item_id": link.template_item_id,
                        "qty": link.qty,
                    }
                    for link in (se.template_item_links or [])
                ],
                "audio": [
                    {
                        "audio_track_id": al.audio_track_id,
                        "volume": al.volume,
                        "loop": al.loop,
                        "fade_in": al.fade_in,
                        "fade_out": al.fade_out,
                        "order_num": al.order_num,
                    }
                    for al in (se.audio_tracks or [])
                ],
            }
        )

    audio_tracks: list[dict[str, Any]] = []
    if audio_ids:
        rows = (
            await db.execute(select(models.AudioTrack).where(models.AudioTrack.id.in_(list(audio_ids))))
        ).scalars().all()
        audio_tracks = [
            _row_to_dict(t, models.AudioTrack, exclude=frozenset({"created_by"})) for t in rows
        ]

    obstacles = [_row_to_dict(o, models.Obstacle) for o in (src.obstacles or [])]
    notes = [_row_to_dict(n, models.Note) for n in (src.notes or [])]
    counters = [_row_to_dict(c, models.Counter) for c in (src.counters or [])]
    todos = [_row_to_dict(t, models.ScenarioTodo) for t in (src.todos or [])]

    pack_links = list(src.entity_pack_links or [])
    packs_out: list[dict[str, Any]] = []
    members_out: list[dict[str, Any]] = []
    template_npcs: list[dict[str, Any]] = []
    template_items: list[dict[str, Any]] = []
    template_chars: list[dict[str, Any]] = []
    template_ownership: list[dict[str, Any]] = []

    pack_ids = [link.pack_id for link in pack_links]
    if pack_ids:
        packs = (
            await db.execute(
                select(models.EntityPack)
                .where(models.EntityPack.id.in_(pack_ids))
                .options(selectinload(models.EntityPack.members))
            )
        ).scalars().all()
        for pack in packs:
            packs_out.append(_row_to_dict(pack, models.EntityPack))
            for m in pack.members or []:
                members_out.append(_row_to_dict(m, models.EntityPackMember))

        npc_ids = [_parse_uuid(m["entity_id"]) for m in members_out if m.get("entity_kind") == "npc"]
        item_ids = [
            _parse_uuid(m["entity_id"]) for m in members_out if m.get("entity_kind") == "game_item"
        ]
        char_ids = [
            _parse_uuid(m["entity_id"])
            for m in members_out
            if m.get("entity_kind") == "player_character"
        ]
        npc_ids = [i for i in npc_ids if i]
        item_ids = [i for i in item_ids if i]
        char_ids = [i for i in char_ids if i]

        if npc_ids:
            for npc in (
                await db.execute(
                    select(models.NPC)
                    .where(models.NPC.id.in_(npc_ids))
                    .options(selectinload(models.NPC.owned_item_links))
                )
            ).scalars().all():
                template_npcs.append(_row_to_dict(npc, models.NPC))
                for link in npc.owned_item_links or []:
                    template_ownership.append(_row_to_dict(link, models.ItemOwnership))

        if item_ids:
            for item in (
                await db.execute(
                    select(models.GameItem)
                    .where(models.GameItem.id.in_(item_ids))
                    .options(selectinload(models.GameItem.contained_item_links))
                )
            ).scalars().all():
                template_items.append(_row_to_dict(item, models.GameItem))
                for link in item.contained_item_links or []:
                    template_ownership.append(_row_to_dict(link, models.ItemOwnership))

        if char_ids:
            for ch in (
                await db.execute(
                    select(models.PlayerCharacter)
                    .where(models.PlayerCharacter.id.in_(char_ids))
                    .options(selectinload(models.PlayerCharacter.owned_item_links))
                )
            ).scalars().all():
                template_chars.append(_row_to_dict(ch, models.PlayerCharacter))
                for link in ch.owned_item_links or []:
                    template_ownership.append(_row_to_dict(link, models.ItemOwnership))

    template_entity_links = (
        await db.execute(
            select(models.ScenarioTemplateEntityLink).where(
                models.ScenarioTemplateEntityLink.scenario_id == scenario_id
            )
        )
    ).scalars().all()

    entity_packs = {
        "packs": packs_out,
        "members": members_out,
        "scenario_links": [_row_to_dict(l, models.ScenarioEntityPackLink) for l in pack_links],
        "template_entity_links": [
            _row_to_dict(l, models.ScenarioTemplateEntityLink) for l in template_entity_links
        ],
        "template_npcs": template_npcs,
        "template_items": template_items,
        "template_characters": template_chars,
        "template_item_ownership": template_ownership,
    }

    json_files: dict[str, Any] = {
        "scenario.json": scenario,
        "locations.json": locations,
        "map_polygons.json": map_polygons,
        "npcs.json": npcs,
        "items.json": items,
        "characters.json": characters,
        "item_ownership.json": item_ownership,
        "story_beats.json": story_beats,
        "story_beat_links.json": story_beat_links,
        "scene_exposures.json": scene_exposures,
        "scene_exposure_links.json": scene_exposure_links,
        "obstacles.json": obstacles,
        "notes.json": notes,
        "counters.json": counters,
        "todos.json": todos,
        "audio_tracks.json": audio_tracks,
        "entity_packs.json": entity_packs,
    }

    media_rels: set[str] = set()
    for name, payload in json_files.items():
        if name == "entity_packs.json":
            for key in ("template_npcs", "template_items", "template_characters"):
                media_rels |= collect_media_from_entities(payload.get(key) or [])
            continue
        if isinstance(payload, list):
            media_rels |= collect_media_from_entities(payload)
        elif isinstance(payload, dict):
            media_rels |= collect_media_from_entities([payload])

    media_bytes: dict[str, bytes] = {}
    media_meta: list[dict[str, Any]] = []
    for rel in sorted(media_rels):
        disk = MEDIA_ROOT / rel
        if not disk.is_file():
            warnings.append(f"missing media file: {rel}")
            continue
        content = disk.read_bytes()
        media_bytes[rel] = content
        media_meta.append(
            {
                "path": rel,
                "sha256": hashlib.sha256(content).hexdigest(),
                "size": len(content),
            }
        )

    manifest = {
        "format_version": FORMAT_VERSION,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "rule_id_str": src.rule_id_str,
        "root_scenario_id": src.id,
        "app_hint": "nri-scenario-archive",
        "files": list(json_files.keys()),
        "media": media_meta,
        "warnings": list(warnings),
    }
    json_files["manifest.json"] = manifest
    return json_files, media_bytes, warnings


async def export_scenario_archive(db: AsyncSession, scenario_id: UUID) -> io.BytesIO:
    json_files, media_bytes, _warnings = await build_archive_payload(db, scenario_id)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for name, payload in json_files.items():
            zf.writestr(name, dumps(payload))
        for rel, content in media_bytes.items():
            zf.writestr(f"media/{rel}", content)
    buf.seek(0)
    return buf


# ---------------------------------------------------------------------------
# Import
# ---------------------------------------------------------------------------


def _read_zip_json(zf: zipfile.ZipFile, name: str, default: Any = None) -> Any:
    try:
        return loads(zf.read(name))
    except KeyError:
        return default


async def _exists(db: AsyncSession, model_cls: type, entity_id: UUID) -> bool:
    return (await db.get(model_cls, entity_id)) is not None


async def _create_if_missing(
    db: AsyncSession,
    model_cls: type,
    entity_id: UUID,
    kwargs: dict[str, Any],
    report: ImportReport,
    key: str,
) -> bool:
    if await _exists(db, model_cls, entity_id):
        report.bump(report.skipped, key)
        return False
    db.add(model_cls(id=entity_id, **kwargs))
    report.bump(report.created, key)
    return True


async def _ensure_table_link(
    db: AsyncSession,
    table: Any,
    where_cols: dict[str, Any],
    report: ImportReport,
    key: str,
) -> None:
    cond = [getattr(table.c, col) == val for col, val in where_cols.items()]
    exists = (await db.execute(select(1).select_from(table).where(*cond))).first()
    if exists:
        report.bump(report.skipped, key)
        return
    await db.execute(table.insert().values(**where_cols))
    report.bump(report.created, key)


async def import_scenario_archive(
    db: AsyncSession,
    zip_bytes: bytes,
    *,
    owner_user_id: UUID,
) -> ImportReport:
    report = ImportReport(imported=False)

    try:
        zf_holder = zipfile.ZipFile(io.BytesIO(zip_bytes), mode="r")
    except zipfile.BadZipFile as exc:
        raise ArchiveFormatError("Файл не является ZIP-архивом") from exc

    with zf_holder as zf:
        raw_manifest = _read_zip_json(zf, "manifest.json")
        if not isinstance(raw_manifest, dict):
            raise ArchiveFormatError("В архиве нет manifest.json")
        try:
            manifest = ManifestV1.model_validate(raw_manifest)
        except Exception as exc:
            raise ArchiveFormatError(f"Некорректный manifest.json: {exc}") from exc

        if manifest.format_version != FORMAT_VERSION:
            raise ArchiveFormatError(
                f"Неподдерживаемая format_version={manifest.format_version} "
                f"(ожидается {FORMAT_VERSION})"
            )

        root_id = manifest.root_scenario_id
        report.id = root_id

        if await _exists(db, models.Scenario, root_id):
            report.reason = "scenario_exists"
            report.warnings.extend(manifest.warnings or [])
            return report

        scenario_raw = _read_zip_json(zf, "scenario.json")
        if not isinstance(scenario_raw, dict):
            raise ArchiveFormatError("В архиве нет scenario.json")

        rule_id = scenario_raw.get("rule_id_str") or manifest.rule_id_str
        if rule_id:
            try:
                from app.plugins.registry_singleton import registry

                registry.get(str(rule_id))
            except Exception:
                report.warnings.append(f"rule plugin not found on target stand: {rule_id}")

        sc_data = _filter_columns(
            models.Scenario,
            _prepare_entity(scenario_raw, exclude=SCENARIO_EXCLUDE | frozenset({"created"})),
        )
        sc_data["user_id"] = owner_user_id
        sc_data["is_session_snapshot"] = False
        sc_data["source_scenario_id"] = None
        sc_data["lifecycle_status"] = None
        sc_data["launch_mode"] = None
        db.add(models.Scenario(id=root_id, **sc_data))
        report.bump(report.created, "scenario")
        await db.flush()

        async def ingest_list(
            filename: str,
            model_cls: type,
            key: str,
            *,
            force: dict[str, Any] | None = None,
            exclude: frozenset[str] = frozenset(),
        ) -> list[dict[str, Any]]:
            rows = _read_zip_json(zf, filename, default=[]) or []
            if not isinstance(rows, list):
                return []
            for raw in rows:
                if not isinstance(raw, dict) or raw.get("id") is None:
                    continue
                eid = _parse_uuid(raw["id"])
                if eid is None:
                    continue
                data = _filter_columns(model_cls, _prepare_entity(raw, exclude=exclude))
                if force:
                    data.update(force)
                await _create_if_missing(db, model_cls, eid, data, report, key)
            await db.flush()
            return rows

        await ingest_list(
            "obstacles.json", models.Obstacle, "obstacles", force={"scenario_id": root_id}
        )

        loc_rows = await ingest_list(
            "locations.json",
            models.Location,
            "locations",
            force={"scenario_id": root_id},
            exclude=frozenset({"parent_location_id"}),
        )
        for raw in loc_rows:
            if not isinstance(raw, dict) or not raw.get("parent_location_id"):
                continue
            loc = await db.get(models.Location, _parse_uuid(raw["id"]))
            if loc and loc.parent_location_id is None:
                parent_id = _parse_uuid(raw["parent_location_id"])
                if parent_id and await _exists(db, models.Location, parent_id):
                    loc.parent_location_id = parent_id
        await db.flush()

        await ingest_list("map_polygons.json", models.MapObjectPolygon, "map_polygons")
        await ingest_list("npcs.json", models.NPC, "npcs", force={"scenario_id": root_id})
        await ingest_list("items.json", models.GameItem, "items", force={"scenario_id": root_id})
        await ingest_list(
            "characters.json",
            models.PlayerCharacter,
            "characters",
            force={"scenario_id": root_id},
        )

        for raw in _read_zip_json(zf, "item_ownership.json", default=[]) or []:
            if not isinstance(raw, dict) or raw.get("id") is None:
                continue
            eid = _parse_uuid(raw["id"])
            if eid is None:
                continue
            data = _filter_columns(models.ItemOwnership, _prepare_entity(raw))
            item_id = data.get("item_id")
            if not item_id or not await _exists(db, models.GameItem, item_id):
                report.bump(report.skipped, "item_ownership")
                continue
            owner_ok = False
            for field_name, model_cls in (
                ("character_id", models.PlayerCharacter),
                ("npc_id", models.NPC),
                ("owner_item_id", models.GameItem),
            ):
                oid = data.get(field_name)
                if oid and await _exists(db, model_cls, oid):
                    owner_ok = True
                elif oid:
                    data[field_name] = None
            if not owner_ok:
                report.bump(report.skipped, "item_ownership")
                continue
            await _create_if_missing(db, models.ItemOwnership, eid, data, report, "item_ownership")
        await db.flush()

        await ingest_list("notes.json", models.Note, "notes", force={"scenario_id": root_id})
        await ingest_list(
            "counters.json", models.Counter, "counters", force={"scenario_id": root_id}
        )

        beat_rows = await ingest_list(
            "story_beats.json",
            models.StoryBeat,
            "story_beats",
            force={"scenario_id": root_id},
            exclude=frozenset({"parent_story_beat_id"}),
        )
        for raw in beat_rows:
            if not isinstance(raw, dict) or not raw.get("parent_story_beat_id"):
                continue
            beat = await db.get(models.StoryBeat, _parse_uuid(raw["id"]))
            if beat and beat.parent_story_beat_id is None:
                parent_id = _parse_uuid(raw["parent_story_beat_id"])
                if parent_id and await _exists(db, models.StoryBeat, parent_id):
                    beat.parent_story_beat_id = parent_id
        await db.flush()

        for link in _read_zip_json(zf, "story_beat_links.json", default=[]) or []:
            if not isinstance(link, dict):
                continue
            sb_id = _parse_uuid(link.get("story_beat_id"))
            if not sb_id or not await _exists(db, models.StoryBeat, sb_id):
                report.bump(report.skipped, "story_beat_links")
                continue
            for loc_id in link.get("location_ids") or []:
                lid = _parse_uuid(loc_id)
                if lid and await _exists(db, models.Location, lid):
                    await _ensure_table_link(
                        db,
                        story_beat_location,
                        {"story_beat_id": sb_id, "location_id": lid},
                        report,
                        "story_beat_links",
                    )
            for npc_id in link.get("npc_ids") or []:
                nid = _parse_uuid(npc_id)
                if nid and await _exists(db, models.NPC, nid):
                    await _ensure_table_link(
                        db,
                        story_beat_npc,
                        {"story_beat_id": sb_id, "npc_id": nid},
                        report,
                        "story_beat_links",
                    )
        await db.flush()

        await ingest_list(
            "scene_exposures.json",
            models.SceneExposure,
            "scene_exposures",
            force={"scenario_id": root_id},
        )
        await ingest_list(
            "audio_tracks.json",
            models.AudioTrack,
            "audio_tracks",
            exclude=frozenset({"created_by", "created_at"}),
            force={"created_by": owner_user_id},
        )

        for link in _read_zip_json(zf, "scene_exposure_links.json", default=[]) or []:
            if not isinstance(link, dict):
                continue
            se_id = _parse_uuid(link.get("scene_exposure_id"))
            if not se_id or not await _exists(db, models.SceneExposure, se_id):
                report.bump(report.skipped, "scene_exposure_links")
                continue

            for npc_id in link.get("npc_ids") or []:
                nid = _parse_uuid(npc_id)
                if nid and await _exists(db, models.NPC, nid):
                    await _ensure_table_link(
                        db,
                        scene_exposure_npc,
                        {"scene_exposure_id": se_id, "npc_id": nid},
                        report,
                        "scene_exposure_links",
                    )
            for item_id in link.get("item_ids") or []:
                iid = _parse_uuid(item_id)
                if iid and await _exists(db, models.GameItem, iid):
                    await _ensure_table_link(
                        db,
                        scene_exposure_item,
                        {"scene_exposure_id": se_id, "item_id": iid},
                        report,
                        "scene_exposure_links",
                    )
            for obstacle_id in link.get("obstacle_ids") or []:
                oid = _parse_uuid(obstacle_id)
                if oid and await _exists(db, models.Obstacle, oid):
                    await _ensure_table_link(
                        db,
                        scene_exposure_obstacle,
                        {"scene_exposure_id": se_id, "obstacle_id": oid},
                        report,
                        "scene_exposure_links",
                    )

            for tn in link.get("template_npcs") or []:
                if not isinstance(tn, dict):
                    continue
                template_npc_id = _parse_uuid(tn.get("template_npc_id"))
                if not template_npc_id or not await _exists(db, models.NPC, template_npc_id):
                    report.bump(report.skipped, "scene_exposure_template_npcs")
                    continue
                link_id = _parse_uuid(tn.get("id"))
                if link_id and await _exists(db, models.SceneExposureTemplateNPC, link_id):
                    report.bump(report.skipped, "scene_exposure_template_npcs")
                    continue
                kwargs = {
                    "scene_exposure_id": se_id,
                    "template_npc_id": template_npc_id,
                    "qty": int(tn.get("qty") or 1),
                }
                if link_id:
                    db.add(models.SceneExposureTemplateNPC(id=link_id, **kwargs))
                else:
                    db.add(models.SceneExposureTemplateNPC(**kwargs))
                report.bump(report.created, "scene_exposure_template_npcs")

            for ti in link.get("template_items") or []:
                if not isinstance(ti, dict):
                    continue
                template_item_id = _parse_uuid(ti.get("template_item_id"))
                if not template_item_id or not await _exists(db, models.GameItem, template_item_id):
                    report.bump(report.skipped, "scene_exposure_template_items")
                    continue
                link_id = _parse_uuid(ti.get("id"))
                if link_id and await _exists(db, models.SceneExposureTemplateItem, link_id):
                    report.bump(report.skipped, "scene_exposure_template_items")
                    continue
                kwargs = {
                    "scene_exposure_id": se_id,
                    "template_item_id": template_item_id,
                    "qty": int(ti.get("qty") or 1),
                }
                if link_id:
                    db.add(models.SceneExposureTemplateItem(id=link_id, **kwargs))
                else:
                    db.add(models.SceneExposureTemplateItem(**kwargs))
                report.bump(report.created, "scene_exposure_template_items")

            for al in link.get("audio") or []:
                if not isinstance(al, dict):
                    continue
                track_id = _parse_uuid(al.get("audio_track_id"))
                if not track_id or not await _exists(db, models.AudioTrack, track_id):
                    report.bump(report.skipped, "scene_exposure_audio")
                    continue
                existing = await db.get(models.SceneExposureAudio, (se_id, track_id))
                if existing:
                    report.bump(report.skipped, "scene_exposure_audio")
                    continue
                db.add(
                    models.SceneExposureAudio(
                        scene_exposure_id=se_id,
                        audio_track_id=track_id,
                        volume=float(al.get("volume", 0.5)),
                        loop=bool(al.get("loop", True)),
                        fade_in=float(al.get("fade_in", 2.0)),
                        fade_out=float(al.get("fade_out", 2.0)),
                        order_num=int(al.get("order_num", 0)),
                    )
                )
                report.bump(report.created, "scene_exposure_audio")
        await db.flush()

        packs_blob = _read_zip_json(zf, "entity_packs.json", default={}) or {}
        if isinstance(packs_blob, dict):
            for raw in packs_blob.get("template_items") or []:
                if not isinstance(raw, dict) or raw.get("id") is None:
                    continue
                eid = _parse_uuid(raw["id"])
                if eid is None:
                    continue
                data = _filter_columns(models.GameItem, _prepare_entity(raw))
                data["scenario_id"] = None
                await _create_if_missing(db, models.GameItem, eid, data, report, "template_items")
            await db.flush()

            for raw in packs_blob.get("template_npcs") or []:
                if not isinstance(raw, dict) or raw.get("id") is None:
                    continue
                eid = _parse_uuid(raw["id"])
                if eid is None:
                    continue
                data = _filter_columns(models.NPC, _prepare_entity(raw))
                data["scenario_id"] = None
                await _create_if_missing(db, models.NPC, eid, data, report, "template_npcs")
            await db.flush()

            for raw in packs_blob.get("template_characters") or []:
                if not isinstance(raw, dict) or raw.get("id") is None:
                    continue
                eid = _parse_uuid(raw["id"])
                if eid is None:
                    continue
                data = _filter_columns(models.PlayerCharacter, _prepare_entity(raw))
                data["scenario_id"] = None
                await _create_if_missing(
                    db, models.PlayerCharacter, eid, data, report, "template_characters"
                )
            await db.flush()

            for raw in packs_blob.get("template_item_ownership") or []:
                if not isinstance(raw, dict) or raw.get("id") is None:
                    continue
                eid = _parse_uuid(raw["id"])
                if eid is None:
                    continue
                data = _filter_columns(models.ItemOwnership, _prepare_entity(raw))
                item_id = data.get("item_id")
                if not item_id or not await _exists(db, models.GameItem, item_id):
                    report.bump(report.skipped, "template_item_ownership")
                    continue
                await _create_if_missing(
                    db, models.ItemOwnership, eid, data, report, "template_item_ownership"
                )
            await db.flush()

            for raw in packs_blob.get("packs") or []:
                if not isinstance(raw, dict) or raw.get("id") is None:
                    continue
                eid = _parse_uuid(raw["id"])
                if eid is None:
                    continue
                data = _filter_columns(models.EntityPack, _prepare_entity(raw))
                await _create_if_missing(db, models.EntityPack, eid, data, report, "entity_packs")
            await db.flush()

            for raw in packs_blob.get("members") or []:
                if not isinstance(raw, dict) or raw.get("id") is None:
                    continue
                eid = _parse_uuid(raw["id"])
                if eid is None:
                    continue
                data = _filter_columns(models.EntityPackMember, _prepare_entity(raw))
                pack_id = data.get("pack_id")
                if not pack_id or not await _exists(db, models.EntityPack, pack_id):
                    report.bump(report.skipped, "entity_pack_members")
                    continue
                await _create_if_missing(
                    db, models.EntityPackMember, eid, data, report, "entity_pack_members"
                )
            await db.flush()

            for raw in packs_blob.get("scenario_links") or []:
                if not isinstance(raw, dict) or raw.get("id") is None:
                    continue
                eid = _parse_uuid(raw["id"])
                if eid is None:
                    continue
                data = _filter_columns(models.ScenarioEntityPackLink, _prepare_entity(raw))
                data["scenario_id"] = root_id
                pack_id = data.get("pack_id")
                if not pack_id or not await _exists(db, models.EntityPack, pack_id):
                    report.warnings.append(f"entity pack missing for scenario link: {pack_id}")
                    report.bump(report.skipped, "scenario_entity_pack_links")
                    continue
                await _create_if_missing(
                    db,
                    models.ScenarioEntityPackLink,
                    eid,
                    data,
                    report,
                    "scenario_entity_pack_links",
                )
            await db.flush()

            for raw in packs_blob.get("template_entity_links") or []:
                if not isinstance(raw, dict) or raw.get("id") is None:
                    continue
                eid = _parse_uuid(raw["id"])
                if eid is None:
                    continue
                data = _filter_columns(
                    models.ScenarioTemplateEntityLink, _prepare_entity(raw)
                )
                data["scenario_id"] = root_id
                await _create_if_missing(
                    db,
                    models.ScenarioTemplateEntityLink,
                    eid,
                    data,
                    report,
                    "scenario_template_entity_links",
                )
            await db.flush()

        await ingest_list("todos.json", models.ScenarioTodo, "todos", force={"scenario_id": root_id})

        for info in zf.infolist():
            name = info.filename
            if not name.startswith("media/") or info.is_dir():
                continue
            rel = name[len("media/") :]
            if not rel or ".." in Path(rel).parts:
                continue
            dest = MEDIA_ROOT / rel
            if dest.exists():
                report.bump(report.skipped, "media_files")
                continue
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(zf.read(name))
            report.bump(report.created, "media_files")

        report.imported = True
        report.warnings.extend(manifest.warnings or [])
        return report
