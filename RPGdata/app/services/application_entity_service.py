"""Application workflow entities stored in regular scenario tables."""

from __future__ import annotations

import copy
import uuid
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app import models

APPLICATION_CHARACTER_TAG = "application_character"
BOUND_ITEM_TAG = "application_bound"


def _ensure_tag(tags: list | None, tag: str) -> list:
    result = [str(t) for t in (tags or [])]
    if tag not in result:
        result.append(tag)
    return result


async def create_player_character_for_application(
    db: AsyncSession,
    app: models.CharacterApplication,
) -> models.PlayerCharacter:
    pc = models.PlayerCharacter(
        id=uuid.uuid4(),
        name=app.name,
        short_desc=app.short_desc,
        story=app.story,
        tags=_ensure_tag(app.tags, APPLICATION_CHARACTER_TAG),
        data=copy.deepcopy(app.data) if app.data else {},
        icon_url=app.icon_url,
        icon_path=app.icon_path,
        img_url=app.img_url,
        img_path=app.img_path,
        scenario_id=None,
    )
    db.add(pc)
    await db.flush()
    app.player_character_id = pc.id
    return pc


async def sync_application_character_from_application(
    db: AsyncSession,
    app: models.CharacterApplication,
) -> models.PlayerCharacter:
    if app.player_character_id:
        pc = await db.get(models.PlayerCharacter, app.player_character_id)
        if pc is None:
            app.player_character_id = None
        else:
            pc.name = app.name
            pc.short_desc = app.short_desc
            pc.story = app.story
            pc.tags = _ensure_tag(app.tags, APPLICATION_CHARACTER_TAG)
            pc.data = copy.deepcopy(app.data) if app.data else {}
            pc.icon_url = app.icon_url
            pc.icon_path = app.icon_path
            pc.img_url = app.img_url
            pc.img_path = app.img_path
            await db.flush()
            return pc

    return await create_player_character_for_application(db, app)


async def load_application_with_character(
    db: AsyncSession,
    application_id: UUID,
) -> models.CharacterApplication | None:
    stmt = (
        select(models.CharacterApplication)
        .where(models.CharacterApplication.id == application_id)
        .options(
            selectinload(models.CharacterApplication.player_character)
            .selectinload(models.PlayerCharacter.owned_item_links)
            .selectinload(models.ItemOwnership.item),
        )
    )
    return (await db.execute(stmt)).scalars().first()


async def grant_item_to_application_character(
    db: AsyncSession,
    app: models.CharacterApplication,
    *,
    item_id: UUID,
    master_id: UUID | None = None,
    master_comment: str | None = None,
) -> models.ItemOwnership:
    pc = await sync_application_character_from_application(db, app)
    item = await db.get(models.GameItem, item_id)
    if item is None:
        raise ValueError("item not found")

    pool_item = item
    if item.scenario_id is not None:
        pool_item = models.GameItem(
            id=uuid.uuid4(),
            name=item.name,
            description_for_master=item.description_for_master,
            description_for_players=item.description_for_players,
            tags=_ensure_tag(item.tags, BOUND_ITEM_TAG),
            data=copy.deepcopy(item.data) if item.data else {},
            icon_url=item.icon_url,
            icon_path=getattr(item, "icon_path", None),
            img_url=item.img_url,
            img_path=getattr(item, "img_path", None),
            scenario_id=None,
            copied_from=item.id,
        )
        db.add(pool_item)
        await db.flush()

    existing = (
        await db.execute(
            select(models.ItemOwnership).where(
                models.ItemOwnership.character_id == pc.id,
                models.ItemOwnership.item_id == pool_item.id,
            )
        )
    ).scalars().first()
    if existing:
        return existing

    link = models.ItemOwnership(
        character_id=pc.id,
        item_id=pool_item.id,
        qty=1,
        equipped=False,
    )
    db.add(link)
    await db.flush()
    return link


def character_dict_from_application(app: models.CharacterApplication) -> dict[str, Any]:
    base_application_id = str(app.id)
    if pc := app.player_character:
        return {
            "id": str(pc.id),
            "application_id": base_application_id,
            "name": pc.name,
            "short_desc": pc.short_desc,
            "story": pc.story,
            "icon_url": str(pc.icon_url) if pc.icon_url else None,
            "img_url": str(pc.img_url) if pc.img_url else None,
            "tags": pc.tags or [],
            "data": pc.data or {},
            "owned_items": [
                {
                    "id": str(link.item_id),
                    "name": getattr(link.item, "name", None),
                    "qty": link.qty,
                    "equipped": link.equipped,
                }
                for link in (pc.owned_item_links or [])
                if link.item is not None
            ],
            "location_id": str(pc.location_id) if pc.location_id else None,
        }

    return {
        "id": str(app.player_character_id or app.id),
        "application_id": base_application_id,
        "name": app.name,
        "short_desc": app.short_desc,
        "story": app.story,
        "icon_url": str(app.icon_url) if app.icon_url else None,
        "img_url": str(app.img_url) if app.img_url else None,
        "tags": app.tags or [],
        "data": app.data or {},
        "owned_items": [],
        "location_id": None,
    }


def index_applications_by_id(
    apps: list[models.CharacterApplication],
) -> dict[UUID, models.CharacterApplication]:
    """Index by both application id and pool character id."""
    out: dict[UUID, models.CharacterApplication] = {}
    for app in apps:
        out[app.id] = app
        if app.player_character_id:
            out[app.player_character_id] = app
    return out


async def ensure_applications_attached_to_scenario(
    db: AsyncSession,
    *,
    scenario_id: UUID,
    apps_by_id: dict[UUID, models.CharacterApplication],
) -> dict[UUID, models.PlayerCharacter]:
    """Deduplicate apps_by_id values and attach pool characters to scenario."""
    if not apps_by_id:
        return {}
    unique_apps = {app.id: app for app in apps_by_id.values()}
    return await attach_application_characters_to_scenario(
        db,
        scenario_id=scenario_id,
        applications=list(unique_apps.values()),
    )


async def attach_application_characters_to_scenario(
    db: AsyncSession,
    *,
    scenario_id: UUID,
    applications: list[models.CharacterApplication],
) -> dict[UUID, models.PlayerCharacter]:
    attached: dict[UUID, models.PlayerCharacter] = {}
    for app in applications:
        if not app.player_character_id:
            await sync_application_character_from_application(db, app)
        if not app.player_character_id:
            continue

        pc = app.player_character
        if pc is None:
            pc = await db.get(
                models.PlayerCharacter,
                app.player_character_id,
                options=[selectinload(models.PlayerCharacter.owned_item_links).selectinload(models.ItemOwnership.item)],
            )
        if pc is None:
            continue

        # Always bind to the target scenario (re-approach after detach / stuck on other scenario).
        pc.scenario_id = scenario_id
        if getattr(app, "user_id", None):
            pc.bound_user_id = app.user_id
        attached[pc.id] = pc

        for link in pc.owned_item_links or []:
            item = link.item
            if item is None:
                continue
            item.scenario_id = scenario_id
            item.tags = _ensure_tag(item.tags, BOUND_ITEM_TAG)

    await db.flush()
    return attached


async def detach_application_pool_from_scenario(
    db: AsyncSession,
    scenario_id: UUID,
) -> None:
    stmt = (
        select(models.PlayerCharacter)
        .join(
            models.CharacterApplication,
            models.CharacterApplication.player_character_id == models.PlayerCharacter.id,
        )
        .where(models.PlayerCharacter.scenario_id == scenario_id)
        .options(
            selectinload(models.PlayerCharacter.owned_item_links).selectinload(models.ItemOwnership.item),
        )
    )
    characters = list((await db.execute(stmt)).scalars().all())

    for pc in characters:
        pc.scenario_id = None
        pc.location_id = None
        for link in pc.owned_item_links or []:
            item = link.item
            if item is None:
                continue
            if item.scenario_id == scenario_id:
                item.scenario_id = None

    await db.flush()
