from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app import models
from app.services.entity_packs import normalize_pack_tags

from app.services.name_generators_merge import merge_name_generators_config


def entry_to_generator_dict(entry: models.NamePackEntry) -> dict[str, Any]:
    return {
        "name": entry.text,
        "part_kind": entry.part_kind or "full",
        "tags": list(entry.tags or []),
        "description": entry.description or "",
        "source": "pack",
    }


async def _entries_for_pack_ids(db: AsyncSession, pack_ids: list[UUID]) -> list[dict[str, Any]]:
    if not pack_ids:
        return []
    rows = (
        await db.execute(
            select(models.NamePackEntry)
            .where(models.NamePackEntry.pack_id.in_(pack_ids))
            .order_by(
                models.NamePackEntry.pack_id.asc(),
                models.NamePackEntry.sort_order.asc(),
                models.NamePackEntry.text.asc(),
            )
        )
    ).scalars().all()
    return [entry_to_generator_dict(r) for r in rows]


async def load_pack_entries_for_scenario(db: AsyncSession, scenario_id: UUID) -> list[dict[str, Any]]:
    links = (
        await db.execute(
            select(models.ScenarioNamePackLink.name_pack_id)
            .where(
                models.ScenarioNamePackLink.scenario_id == scenario_id,
                models.ScenarioNamePackLink.enabled.is_(True),
            )
            .order_by(models.ScenarioNamePackLink.order_num.asc())
        )
    ).scalars().all()
    return await _entries_for_pack_ids(db, list(links))


async def enrich_editor_schema_with_name_packs(
    db: AsyncSession,
    schema: dict[str, Any],
    *,
    scenario_id: UUID | None = None,
) -> dict[str, Any]:
    if not isinstance(schema, dict) or scenario_id is None:
        return schema

    base_ng = schema.get("nameGenerators")
    if not isinstance(base_ng, dict):
        base_ng = {}
    pbta = schema.get("pbta")
    if isinstance(pbta, dict) and isinstance(pbta.get("nameGenerators"), dict):
        pbta_entries = pbta["nameGenerators"].get("entries") or []
        if pbta_entries and not base_ng.get("entries"):
            base_ng = dict(pbta["nameGenerators"])
        elif pbta_entries:
            merged_entries = list(base_ng.get("entries") or [])
            seen = {f"{e.get('part_kind', 'full')}:{e.get('name')}" for e in merged_entries if isinstance(e, dict)}
            for raw in pbta_entries:
                if not isinstance(raw, dict):
                    continue
                key = f"{raw.get('part_kind', 'full')}:{raw.get('name')}"
                if key not in seen:
                    merged_entries.append(raw)
                    seen.add(key)
            base_ng = {**base_ng, "entries": merged_entries}

    pack_entries = await load_pack_entries_for_scenario(db, scenario_id)
    merged = merge_name_generators_config(base_ng, pack_entries)
    return {**schema, "nameGenerators": merged}


def normalize_name_pack_tags(tags: list[str] | None) -> list[str]:
    return normalize_pack_tags(tags)


async def get_name_pack_or_404(db: AsyncSession, pack_id: UUID) -> models.NamePack:
    pack = (
        await db.execute(
            select(models.NamePack)
            .where(models.NamePack.id == pack_id)
            .options(selectinload(models.NamePack.entries))
        )
    ).scalars().first()
    if not pack:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Name pack not found")
    return pack
