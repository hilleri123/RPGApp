from __future__ import annotations

from typing import Any
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, scheme
from app.plugins.contracts import EntityPayload
from app.scheme.common import dump_entity_fields
from app.scheme.game_item import ItemUpsertPayload


def _make_entity_payload(payload: ItemUpsertPayload) -> EntityPayload:
    return EntityPayload(
        data=payload.model_dump(mode="json")["data"],
        tags=payload.tags or [],
    )


async def _get_item_or_404(db: AsyncSession, item_id: UUID) -> scheme.GameItemOut:
    obj = (
        await db.execute(
            select(models.GameItem)
            .where(models.GameItem.id == item_id)
            .options(
                selectinload(models.GameItem.ownership_link).selectinload(models.ItemOwnership.character),
                selectinload(models.GameItem.ownership_link).selectinload(models.ItemOwnership.npc),
                selectinload(models.GameItem.ownership_link).selectinload(models.ItemOwnership.owner_item),
            )
        )
    ).scalars().first()
    if not obj:
        raise HTTPException(status_code=404, detail="Предмет не найден")
    return scheme.GameItemOut.model_validate(obj)


async def delete_item(db: AsyncSession, *, item_id: UUID) -> bool:
    obj = (await db.execute(select(models.GameItem).where(models.GameItem.id == item_id))).scalars().first()
    if not obj:
        return False
    await db.delete(obj)
    await db.commit()
    return True


async def upsert_item_from_ws_dict(
    db: AsyncSession,
    *,
    scenario_id: UUID,
    item_dict: dict[str, Any],
    is_create: bool,
) -> scheme.GameItemOut:
    if is_create and not item_dict.get("id"):
        item_dict = {**item_dict, "id": uuid4()}

    payload = ItemUpsertPayload.model_validate(item_dict)

    from app.routes._helpers import apply_item_ownership, validate_entity_data

    result = await validate_entity_data(
        db=db,
        entity="item",
        payload=_make_entity_payload(payload),
        scenario_id=scenario_id,
    )
    if not result.ok and not payload.force:
        raise HTTPException(status_code=400, detail="Item validation failed")

    plugin_data = result.result.model_dump(mode="json")
    entity_data = dump_entity_fields(payload, exclude={"contained_items"})
    for k in plugin_data:
        entity_data.pop(k, None)

    item_id = payload.id
    copied_from = item_dict.get("copied_from")
    if is_create:
        obj = models.GameItem(
            **entity_data,
            **plugin_data,
            scenario_id=scenario_id,
            id=item_id,
            copied_from=copied_from,
        )
        db.add(obj)
    else:
        obj = (await db.execute(select(models.GameItem).where(models.GameItem.id == item_id))).scalars().first()
        if not obj:
            raise HTTPException(status_code=404, detail="Предмет не найден")
        update_fields = dump_entity_fields(
            payload,
            exclude={"contained_items"},
            exclude_unset=True,
            exclude_none=True,
        )
        update_fields["data"] = result.result.data
        update_fields["tags"] = result.result.tags
        for k, v in update_fields.items():
            setattr(obj, k, v)

    if payload.icon_url is not None:
        obj.icon_url = str(payload.icon_url)
    if payload.img_url is not None:
        obj.img_url = str(payload.img_url)

    await db.commit()
    await db.refresh(obj)

    await apply_item_ownership(
        db,
        owner_id=obj.id,
        owner_type=models.OwnerTypeEnum.item,
        scenario_id=scenario_id,
        owned_items=payload.contained_items,
    )
    await db.commit()
    return await _get_item_or_404(db, obj.id)


async def transfer_item_ownership(
    db: AsyncSession,
    *,
    item_id: UUID,
    to_character_id: UUID | None = None,
    to_npc_id: UUID | None = None,
    to_owner_item_id: UUID | None = None,
) -> None:
    await db.execute(delete(models.ItemOwnership).where(models.ItemOwnership.item_id == item_id))
    await db.flush()

    if to_character_id:
        db.add(models.ItemOwnership(item_id=item_id, character_id=to_character_id))
    elif to_npc_id:
        db.add(models.ItemOwnership(item_id=item_id, npc_id=to_npc_id))
    elif to_owner_item_id:
        db.add(models.ItemOwnership(item_id=item_id, owner_item_id=to_owner_item_id))

    await db.commit()
