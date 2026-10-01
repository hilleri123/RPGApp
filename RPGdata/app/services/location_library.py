"""Location library: search locations across the user's scenarios and clone a subtree.

There is no separate "set" entity: any scenario works as a set of locations (a master keeps
e.g. «Городские места» or «Интерьеры» as a scenario). A location flagged with the
``template`` tag is considered a ready-made piece and is ranked first.

Importing copies the location (and optionally its sublocations) into another scenario,
including a running session's snapshot. Map polygons between copied locations are
remapped; links to story/NPC exposures are intentionally not carried over because those
entities live in the source scenario.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app import models
from app.constants.location_kinds import is_kind_tag, kind_of, kind_tag
from app.constants.templates import TEMPLATE_TAG
from app.services.entity_data_rule import stamp_entity_data
from app.services.scenario_cloner import IdMap, _copy_scalar_columns

# Теги, которые не должны переезжать в копию: «старт» и «шаблон» относятся к месту в
# исходном сценарии.
_NON_CARRIED_TAGS = frozenset({"start", TEMPLATE_TAG})
_SEARCH_LIMIT_MAX = 100


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", r"\%").replace("_", r"\_")


async def accessible_scenario_ids(db: AsyncSession, user: models.User) -> list[UUID] | None:
    """Ids of non-snapshot scenarios the user may at least read; None means "all" (admin)."""
    if user.is_admin:
        return None
    via_group = (
        select(models.MasterGroupScenarioAccess.scenario_id)
        .join(
            models.UserMasterGroup,
            models.UserMasterGroup.master_group_id
            == models.MasterGroupScenarioAccess.master_group_id,
        )
        .where(
            models.UserMasterGroup.user_id == user.id,
            models.MasterGroupScenarioAccess.permission != "none",
            models.UserMasterGroup.permission != "none",
        )
    )
    rows = await db.execute(
        select(models.Scenario.id).where(
            models.Scenario.is_session_snapshot.is_(False),
            or_(models.Scenario.user_id == user.id, models.Scenario.id.in_(via_group)),
        )
    )
    return list(rows.scalars().all())


@dataclass
class LibraryHit:
    id: UUID
    name: str
    kind: str | None
    tags: list[str]
    is_template: bool
    scenario_id: UUID
    scenario_name: str
    parent_location_name: str | None
    children_count: int
    icon_url: str | None
    map_url: str | None
    snippet: str


def _snippet(loc: models.Location) -> str:
    import re

    raw = loc.description_for_master or loc.description_for_players or ""
    text = re.sub(r"<[^>]+>", " ", raw)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:160]


async def search_library(
    db: AsyncSession,
    user: models.User,
    *,
    q: str | None = None,
    kinds: list[str] | None = None,
    tags: list[str] | None = None,
    scenario_id: UUID | None = None,
    templates_only: bool = False,
    rule_id_str: str | None = None,
    limit: int = 40,
) -> list[LibraryHit]:
    limit = max(1, min(limit, _SEARCH_LIMIT_MAX))
    allowed = await accessible_scenario_ids(db, user)

    stmt = (
        select(models.Location, models.Scenario.name, models.Scenario.rule_id_str)
        .join(models.Scenario, models.Scenario.id == models.Location.scenario_id)
        .where(models.Scenario.is_session_snapshot.is_(False))
        .options(selectinload(models.Location.parent_location))
    )
    if allowed is not None:
        if not allowed:
            return []
        stmt = stmt.where(models.Location.scenario_id.in_(allowed))
    if scenario_id:
        stmt = stmt.where(models.Location.scenario_id == scenario_id)
    if rule_id_str:
        stmt = stmt.where(models.Scenario.rule_id_str == rule_id_str)
    if q and q.strip():
        pattern = f"%{_escape_like(q.strip())}%"
        stmt = stmt.where(
            or_(
                models.Location.name.ilike(pattern, escape="\\"),
                models.Location.description_for_master.ilike(pattern, escape="\\"),
                models.Location.description_for_players.ilike(pattern, escape="\\"),
            )
        )
    # Теги лежат в JSON-колонке: фильтруем по ним в Python (библиотека — сотни строк,
    # не миллионы), так запрос остаётся переносимым между JSON/JSONB.
    rows = (await db.execute(stmt.order_by(models.Location.name).limit(2000))).all()

    wanted_kinds = {kind_tag(k) for k in (kinds or []) if k}
    wanted_tags = {t for t in (tags or []) if t}

    hits: list[LibraryHit] = []
    child_counts = await _child_counts(db, [loc.id for loc, _, _ in rows])
    for loc, scenario_name, _rule in rows:
        loc_tags = [str(t) for t in (loc.tags or [])]
        is_template = TEMPLATE_TAG in loc_tags
        if templates_only and not is_template:
            continue
        if wanted_kinds and not wanted_kinds.intersection(loc_tags):
            continue
        if wanted_tags and not wanted_tags.issubset(loc_tags):
            continue
        hits.append(
            LibraryHit(
                id=loc.id,
                name=loc.name,
                kind=kind_of(loc_tags),
                tags=[t for t in loc_tags if not is_kind_tag(t)],
                is_template=is_template,
                scenario_id=loc.scenario_id,
                scenario_name=scenario_name,
                parent_location_name=loc.parent_location.name if loc.parent_location else None,
                children_count=child_counts.get(loc.id, 0),
                icon_url=str(loc.icon_url) if loc.icon_url else None,
                map_url=str(loc.map_url) if loc.map_url else None,
                snippet=_snippet(loc),
            )
        )

    hits.sort(key=lambda h: (not h.is_template, h.name.lower()))
    return hits[:limit]


async def _child_counts(db: AsyncSession, parent_ids: list[UUID]) -> dict[UUID, int]:
    if not parent_ids:
        return {}
    rows = await db.execute(
        select(models.Location.parent_location_id, func.count())
        .where(models.Location.parent_location_id.in_(parent_ids))
        .group_by(models.Location.parent_location_id)
    )
    return {pid: int(n) for pid, n in rows.all()}


@dataclass
class ImportResult:
    root_id: UUID
    created_ids: list[UUID] = field(default_factory=list)


def descendants_of(root_id: UUID, all_locations: list[models.Location]) -> list[models.Location]:
    """Root first, then children breadth-first (guards against parent cycles)."""
    by_parent: dict[UUID | None, list[models.Location]] = {}
    by_id = {loc.id: loc for loc in all_locations}
    for loc in all_locations:
        by_parent.setdefault(loc.parent_location_id, []).append(loc)

    root = by_id.get(root_id)
    if root is None:
        return []
    ordered = [root]
    seen = {root.id}
    queue = [root.id]
    while queue:
        current = queue.pop(0)
        for child in sorted(by_parent.get(current, []), key=lambda c: c.name):
            if child.id in seen:
                continue
            seen.add(child.id)
            ordered.append(child)
            queue.append(child.id)
    return ordered


async def import_location(
    db: AsyncSession,
    *,
    source_location_id: UUID,
    target_scenario: models.Scenario,
    parent_location_id: UUID | None = None,
    include_children: bool = True,
) -> ImportResult:
    """Clone a location (+subtree) into ``target_scenario``. Caller checks permissions."""
    source = await db.get(models.Location, source_location_id)
    if source is None or source.scenario_id is None:
        raise LookupError("location not found")
    source_scenario = await db.get(models.Scenario, source.scenario_id)

    all_locations = list(
        (
            await db.execute(
                select(models.Location)
                .where(models.Location.scenario_id == source.scenario_id)
                .options(selectinload(models.Location.map_objects))
            )
        )
        .scalars()
        .all()
    )
    if include_children:
        chain = descendants_of(source.id, all_locations)
    else:
        chain = [loc for loc in all_locations if loc.id == source.id]

    if parent_location_id is not None:
        parent = await db.get(models.Location, parent_location_id)
        if parent is None or parent.scenario_id != target_scenario.id:
            raise ValueError("parent location does not belong to the target scenario")

    same_rule = (
        source_scenario is not None
        and source_scenario.rule_id_str == target_scenario.rule_id_str
    )
    target_rule = target_scenario.rule_id_str

    id_map = IdMap()
    copies: dict[UUID, models.Location] = {}
    for loc in chain:
        new_id = id_map.register(loc.id)
        values = _copy_scalar_columns(
            loc,
            models.Location,
            exclude=frozenset({"scenario_id", "parent_location_id", "tags", "is_start", "data"}),
        )
        copy_tags = [str(t) for t in (loc.tags or []) if str(t) not in _NON_CARRIED_TAGS]
        new_loc = models.Location(
            id=new_id,
            source_entity_id=None,  # lineage связывает prep<->launched, не библиотеку
            **values,
            tags=copy_tags,
            is_start=False,
            data=stamp_entity_data(loc.data, target_rule) if same_rule and loc.data else None,
            scenario_id=target_scenario.id,
            parent_location_id=None,
        )
        db.add(new_loc)
        copies[loc.id] = new_loc
    await db.flush()

    for loc in chain:
        new_loc = copies[loc.id]
        if loc.id == source.id:
            new_loc.parent_location_id = parent_location_id
        else:
            new_loc.parent_location_id = id_map.remap(loc.parent_location_id)

    for loc in chain:
        for mo in loc.map_objects or []:
            target_new = id_map.remap(mo.target_location_id)
            if mo.target_location_id and target_new is None:
                # Переход ведёт за пределы скопированного поддерева — в новом сценарии
                # ему некуда вести, поэтому полигон не переносим.
                continue
            db.add(
                models.MapObjectPolygon(
                    id=id_map.register(mo.id),
                    source_entity_id=None,
                    **_copy_scalar_columns(
                        mo,
                        models.MapObjectPolygon,
                        exclude=frozenset({"source_location_id", "target_location_id"}),
                    ),
                    source_location_id=id_map.remap(loc.id),
                    target_location_id=target_new,
                )
            )
    await db.flush()
    return ImportResult(root_id=copies[source.id].id, created_ids=[c.id for c in copies.values()])
