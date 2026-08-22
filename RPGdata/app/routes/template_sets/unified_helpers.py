from __future__ import annotations

from typing import List
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app import models, scheme
from app.constants.templates import TEMPLATE_TAG, ensure_template_tags
from app.routes._helpers import _OWNER_FIELD


async def ensure_pack_member(
    db: AsyncSession,
    *,
    pack_id: UUID,
    entity_kind: str,
    entity_id: UUID,
) -> None:
    existing = (
        await db.execute(
            select(models.EntityPackMember).where(
                models.EntityPackMember.pack_id == pack_id,
                models.EntityPackMember.entity_kind == entity_kind,
                models.EntityPackMember.entity_id == entity_id,
            )
        )
    ).scalars().first()
    if existing:
        return
    db.add(
        models.EntityPackMember(
            pack_id=pack_id,
            entity_kind=entity_kind,
            entity_id=entity_id,
        )
    )


async def apply_template_item_ownership(
    db: AsyncSession,
    *,
    pack_id: UUID | None = None,
    template_set_id: UUID | None = None,
    owner_type: models.OwnerTypeEnum,
    owner_id: UUID,
    owned_items: List[scheme.ItemContainedLinkIn],
) -> None:
    """Ownership for template entities (scenario_id IS NULL, tag template)."""
    resolved_pack_id = pack_id or template_set_id
    if not resolved_pack_id:
        raise HTTPException(status_code=400, detail="pack_id required")
    item_ids = [x.item_id for x in owned_items]
    if item_ids:
        member_ids = (
            await db.execute(
                select(models.EntityPackMember.entity_id).where(
                    models.EntityPackMember.pack_id == resolved_pack_id,
                    models.EntityPackMember.entity_kind == "game_item",
                    models.EntityPackMember.entity_id.in_(item_ids),
                )
            )
        ).scalars().all()
        found = set(member_ids)
        missing = [str(i) for i in item_ids if i not in found]
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"Некоторые предметы не найдены в паке: {missing}",
            )

    owner_col = _OWNER_FIELD[owner_type]
    await db.execute(delete(models.ItemOwnership).where(owner_col == owner_id))
    await db.flush()

    def _same_owner(link: models.ItemOwnership) -> bool:
        if owner_type == models.OwnerTypeEnum.character:
            return link.character_id == owner_id
        if owner_type == models.OwnerTypeEnum.npc:
            return link.npc_id == owner_id
        if owner_type == models.OwnerTypeEnum.item:
            return link.owner_item_id == owner_id
        return False

    for x in owned_items:
        existing_q = (
            select(models.ItemOwnership)
            .where(models.ItemOwnership.item_id == x.item_id)
            .options(
                selectinload(models.ItemOwnership.character),
                selectinload(models.ItemOwnership.npc),
                selectinload(models.ItemOwnership.owner_item),
            )
        )
        existing = (await db.execute(existing_q)).scalars().first()

        if existing and not _same_owner(existing):
            if not x.take_from_other_owner:
                owner_payload = None
                if existing.character_id and existing.character:
                    owner_payload = {
                        "type": "character",
                        "id": str(existing.character_id),
                        "name": existing.character.name,
                    }
                elif existing.npc_id and existing.npc:
                    owner_payload = {
                        "type": "npc",
                        "id": str(existing.npc_id),
                        "name": existing.npc.name,
                    }
                elif existing.owner_item_id and existing.owner_item:
                    owner_payload = {
                        "type": "item",
                        "id": str(existing.owner_item_id),
                        "name": existing.owner_item.name,
                    }
                raise HTTPException(
                    status_code=409,
                    detail={
                        "code": "ITEM_ALREADY_OWNED",
                        "item_id": str(x.item_id),
                        "owner": owner_payload,
                    },
                )
            await db.delete(existing)
            await db.flush()

        link = models.ItemOwnership(item_id=x.item_id)
        if owner_type == models.OwnerTypeEnum.character:
            link.character_id = owner_id
        elif owner_type == models.OwnerTypeEnum.npc:
            link.npc_id = owner_id
        elif owner_type == models.OwnerTypeEnum.item:
            link.owner_item_id = owner_id
        else:
            raise HTTPException(status_code=500, detail="Unknown owner type")
        db.add(link)


def npc_ids_in_pack(pack_id: UUID):
    return select(models.EntityPackMember.entity_id).where(
        models.EntityPackMember.pack_id == pack_id,
        models.EntityPackMember.entity_kind == "npc",
    )


def item_ids_in_pack(pack_id: UUID):
    return select(models.EntityPackMember.entity_id).where(
        models.EntityPackMember.pack_id == pack_id,
        models.EntityPackMember.entity_kind == "game_item",
    )


def character_ids_in_pack(pack_id: UUID):
    return select(models.EntityPackMember.entity_id).where(
        models.EntityPackMember.pack_id == pack_id,
        models.EntityPackMember.entity_kind == "player_character",
    )


async def get_pack_npc_or_404(
    db: AsyncSession,
    pack_id: UUID,
    npc_id: UUID,
) -> models.NPC:
    obj = (
        await db.execute(
            select(models.NPC)
            .where(
                models.NPC.id == npc_id,
                models.NPC.id.in_(npc_ids_in_pack(pack_id)),
                models.NPC.scenario_id.is_(None),
            )
            .options(
                selectinload(models.NPC.owned_item_links).selectinload(models.ItemOwnership.item),
                selectinload(models.NPC.scene_exposure_template_links),
            )
        )
    ).scalars().first()
    if not obj:
        raise HTTPException(status_code=404, detail="NPC template не найден")
    return obj


async def get_pack_item_or_404(
    db: AsyncSession,
    pack_id: UUID,
    item_id: UUID,
) -> models.GameItem:
    obj = (
        await db.execute(
            select(models.GameItem)
            .where(
                models.GameItem.id == item_id,
                models.GameItem.id.in_(item_ids_in_pack(pack_id)),
                models.GameItem.scenario_id.is_(None),
            )
            .options(
                selectinload(models.GameItem.contained_item_links).selectinload(
                    models.ItemOwnership.item
                ),
                selectinload(models.GameItem.scene_exposure_template_links),
            )
        )
    ).scalars().first()
    if not obj:
        raise HTTPException(status_code=404, detail="Item template not found")
    return obj


async def get_pack_character_or_404(
    db: AsyncSession,
    pack_id: UUID,
    character_id: UUID,
) -> models.PlayerCharacter:
    obj = (
        await db.execute(
            select(models.PlayerCharacter)
            .where(
                models.PlayerCharacter.id == character_id,
                models.PlayerCharacter.id.in_(character_ids_in_pack(pack_id)),
                models.PlayerCharacter.scenario_id.is_(None),
            )
            .options(
                selectinload(models.PlayerCharacter.owned_item_links).selectinload(
                    models.ItemOwnership.item
                ),
            )
        )
    ).scalars().first()
    if not obj:
        raise HTTPException(status_code=404, detail="Character template не найден")
    return obj
