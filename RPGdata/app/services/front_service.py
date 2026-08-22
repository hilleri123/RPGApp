"""Front + ScenarioTag helpers."""

from __future__ import annotations

import re
import uuid
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app import models
from app.models.scenario.front import FRONT_ENTITY_TYPES

_SLUG_RE = re.compile(r"[^a-z0-9_]+")


def slugify_key(raw: str, *, prefix: str = "") -> str:
    base = (raw or "").strip().lower().replace("-", "_").replace(" ", "_")
    base = _SLUG_RE.sub("", base).strip("_")
    if not base:
        base = "tag"
    if prefix:
        return f"{prefix}{base}"[:80]
    return base[:80]


async def unique_tag_key(
    db: AsyncSession,
    scenario_id: UUID,
    desired: str,
) -> str:
    key = slugify_key(desired)
    existing = set(
        (
            await db.execute(
                select(models.ScenarioTag.key).where(
                    models.ScenarioTag.scenario_id == scenario_id
                )
            )
        )
        .scalars()
        .all()
    )
    if key not in existing:
        return key
    for i in range(2, 1000):
        candidate = f"{key}_{i}"
        if candidate not in existing:
            return candidate
    return f"{key}_{uuid.uuid4().hex[:8]}"


def entity_model_for_type(entity_type: str):
    mapping = {
        "npc": models.NPC,
        "story_beat": models.StoryBeat,
        "item": models.GameItem,
        "counter": models.Counter,
        "location": models.Location,
    }
    return mapping.get(entity_type)


async def get_entity(
    db: AsyncSession,
    *,
    scenario_id: UUID,
    entity_type: str,
    entity_id: UUID,
) -> Any | None:
    model = entity_model_for_type(entity_type)
    if model is None:
        return None
    return await db.get(model, entity_id)


def _ensure_tags_list(entity: Any) -> list[str]:
    tags = getattr(entity, "tags", None)
    if not isinstance(tags, list):
        tags = []
    return [str(t) for t in tags]


def add_tag_to_entity(entity: Any, tag_key: str) -> None:
    tags = _ensure_tags_list(entity)
    if tag_key not in tags:
        tags.append(tag_key)
    entity.tags = tags


def remove_tag_from_entity(entity: Any, tag_key: str) -> None:
    tags = _ensure_tags_list(entity)
    entity.tags = [t for t in tags if t != tag_key]


async def sync_member_tag(
    db: AsyncSession,
    *,
    scenario_id: UUID,
    entity_type: str,
    entity_id: UUID,
    tag_key: str,
    add: bool,
) -> None:
    entity = await get_entity(
        db, scenario_id=scenario_id, entity_type=entity_type, entity_id=entity_id
    )
    if entity is None:
        return
    if getattr(entity, "scenario_id", None) != scenario_id:
        return
    if add:
        add_tag_to_entity(entity, tag_key)
    else:
        remove_tag_from_entity(entity, tag_key)


def is_master_wiki_note(note: models.Note) -> bool:
    tags = note.tags if isinstance(note.tags, list) else []
    return "master_wiki" in [str(t) for t in tags]


def build_children_map(
    notes: list[models.Note] | list[Any],
) -> dict[UUID | None, list[Any]]:
    by_parent: dict[UUID | None, list[Any]] = {}
    for n in notes:
        pid = getattr(n, "parent_note_id", None)
        by_parent.setdefault(pid, []).append(n)
    for siblings in by_parent.values():
        siblings.sort(key=lambda x: (int(getattr(x, "sort_order", 0) or 0), str(getattr(x, "name", "") or "")))
    return by_parent


def collect_descendant_ids(
    root_ids: set[UUID],
    notes: list[models.Note] | list[Any],
) -> set[UUID]:
    """Return root_ids plus all descendants via parent_note_id."""
    children = build_children_map(notes)
    out = set(root_ids)
    stack = list(root_ids)
    while stack:
        cur = stack.pop()
        for child in children.get(cur, []):
            cid = child.id if hasattr(child, "id") else child.get("id")
            if cid is None or cid in out:
                continue
            out.add(cid)
            stack.append(cid)
    return out


def wiki_note_ids_for_front(
    front: models.Front,
    notes: list[models.Note] | list[Any],
) -> set[UUID]:
    linked = {link.note_id for link in (front.wiki_notes or []) if link.note_id}
    return collect_descendant_ids(linked, notes)


def front_wiki_tree_nodes(
    front: models.Front,
    notes: list[models.Note] | list[Any],
) -> list[dict]:
    """
    Flat list of wiki notes belonging to the front (linked ∪ descendants),
    each with parent_note_id / depth / implied (not directly linked).
    """
    by_id = {n.id: n for n in notes}
    linked_ids = {link.note_id for link in (front.wiki_notes or []) if link.note_id}
    expanded = collect_descendant_ids(linked_ids, notes)
    children = build_children_map([n for n in notes if n.id in expanded])

    # Roots for display: linked notes that are in expanded, preferring
    # linked notes whose parent is not also in the front set.
    display_roots: list[Any] = []
    for nid in linked_ids:
        note = by_id.get(nid)
        if not note:
            continue
        parent_id = getattr(note, "parent_note_id", None)
        if parent_id is None or parent_id not in expanded:
            display_roots.append(note)
    display_roots.sort(key=lambda x: (int(getattr(x, "sort_order", 0) or 0), str(x.name or "")))

    nodes: list[dict] = []

    def walk(note: Any, depth: int) -> None:
        nid = note.id
        nodes.append(
            {
                "note_id": nid,
                "note_name": getattr(note, "name", None),
                "parent_note_id": getattr(note, "parent_note_id", None),
                "sort_order": int(getattr(note, "sort_order", 0) or 0),
                "depth": depth,
                "implied": nid not in linked_ids,
                "link_id": next(
                    (str(link.id) for link in (front.wiki_notes or []) if link.note_id == nid),
                    None,
                ),
            }
        )
        for child in children.get(nid, []):
            if child.id in expanded:
                walk(child, depth + 1)

    for root in display_roots:
        walk(root, 0)

    # Orphans in expanded that weren't reached (shouldn't happen often)
    seen = {n["note_id"] for n in nodes}
    for nid in expanded - seen:
        note = by_id.get(nid)
        if note:
            nodes.append(
                {
                    "note_id": nid,
                    "note_name": getattr(note, "name", None),
                    "parent_note_id": getattr(note, "parent_note_id", None),
                    "sort_order": int(getattr(note, "sort_order", 0) or 0),
                    "depth": 0,
                    "implied": nid not in linked_ids,
                    "link_id": next(
                        (str(link.id) for link in (front.wiki_notes or []) if link.note_id == nid),
                        None,
                    ),
                }
            )

    return nodes


def front_to_out(front: models.Front, notes: list[models.Note] | None = None) -> dict:
    tag_key = None
    if front.tag is not None:
        tag_key = front.tag.key
    elif getattr(front, "owned_tag", None) is not None:
        tag_key = front.owned_tag.key

    wiki = []
    for link in front.wiki_notes or []:
        wiki.append(
            {
                "id": link.id,
                "front_id": link.front_id,
                "note_id": link.note_id,
                "sort_order": link.sort_order,
                "note_name": getattr(link.note, "name", None) if link.note else None,
            }
        )

    notes_list = notes
    if notes_list is None:
        # Prefer notes loaded via wiki links; full expansion needs all scenario notes.
        notes_list = [link.note for link in (front.wiki_notes or []) if link.note]

    wiki_tree = front_wiki_tree_nodes(front, notes_list) if notes_list is not None else []
    expanded_count = len(wiki_note_ids_for_front(front, notes_list)) if notes_list else len(wiki)

    return {
        "id": front.id,
        "scenario_id": front.scenario_id,
        "name": front.name,
        "description_for_master": front.description_for_master,
        "color": front.color,
        "icon_url": front.icon_url,
        "tag_id": front.tag_id,
        "tag_key": tag_key,
        "members": list(front.members or []),
        "wiki_notes": wiki,
        "wiki_tree": wiki_tree,
        "wiki_note_count": expanded_count,
    }


def front_list_item(front: models.Front, notes: list[models.Note] | None = None) -> dict:
    tag_key = None
    if front.tag is not None:
        tag_key = front.tag.key
    notes_list = notes
    if notes_list is None:
        notes_list = [link.note for link in (front.wiki_notes or []) if link.note]
    count = (
        len(wiki_note_ids_for_front(front, notes_list))
        if notes_list
        else len(front.wiki_notes or [])
    )
    return {
        "id": front.id,
        "scenario_id": front.scenario_id,
        "name": front.name,
        "description_for_master": front.description_for_master,
        "color": front.color,
        "icon_url": front.icon_url,
        "tag_id": front.tag_id,
        "tag_key": tag_key,
        "member_count": len(front.members or []),
        "wiki_note_count": count,
    }


FRONT_LOAD_OPTIONS = (
    selectinload(models.Front.tag),
    selectinload(models.Front.members),
    selectinload(models.Front.wiki_notes).selectinload(models.FrontWikiNote.note),
)


async def load_front(
    db: AsyncSession, scenario_id: UUID, front_id: UUID
) -> models.Front | None:
    stmt = (
        select(models.Front)
        .where(models.Front.id == front_id, models.Front.scenario_id == scenario_id)
        .options(*FRONT_LOAD_OPTIONS)
    )
    return (await db.execute(stmt)).scalars().first()


async def load_scenario_notes(db: AsyncSession, scenario_id: UUID) -> list[models.Note]:
    return list(
        (
            await db.execute(select(models.Note).where(models.Note.scenario_id == scenario_id))
        )
        .scalars()
        .all()
    )


def assert_entity_type(entity_type: str) -> None:
    if entity_type not in FRONT_ENTITY_TYPES:
        raise ValueError(f"unsupported entity_type: {entity_type}")
