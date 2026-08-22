from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app import models, scheme
from app.plugins.contracts import EntityPayload
from app.scheme.character import CharacterUpsertPayload
from app.scheme.common import dump_entity_fields


async def create_character_from_ws_dict(
    db: AsyncSession,
    *,
    scenario_id: UUID,
    ch_dict: dict[str, Any],
    enriched_data: dict,
    tags: list[str],
) -> scheme.PlayerCharacterOut:
    payload = CharacterUpsertPayload.model_validate({
        **{k: v for k, v in ch_dict.items() if k not in ("data", "tags", "owned_items", "force")},
        "data": enriched_data,
        "tags": tags,
        "owned_items": ch_dict.get("owned_items") or [],
        "force": True,
    })

    from app.routes._helpers import apply_item_ownership, validate_entity_data

    result = await validate_entity_data(
        db=db,
        entity="character",
        payload=EntityPayload(data=payload.data, tags=payload.tags or []),
        scenario_id=scenario_id,
    )

    entity_data = dump_entity_fields(payload, exclude={"owned_items"})
    plugin_data = result.result.model_dump(mode="json")
    for k in plugin_data:
        entity_data.pop(k, None)

    obj = models.PlayerCharacter(
        id=payload.id,
        **entity_data,
        **plugin_data,
        scenario_id=scenario_id,
        copied_from=ch_dict.get("copied_from"),
    )
    db.add(obj)
    await db.commit()
    await db.refresh(obj)

    await apply_item_ownership(
        db,
        owner_id=obj.id,
        owner_type=models.OwnerTypeEnum.character,
        scenario_id=scenario_id,
        owned_items=payload.owned_items,
    )
    await db.commit()
    return scheme.PlayerCharacterOut.model_validate(obj)


async def update_character_from_ws_dict(
    db: AsyncSession,
    *,
    scenario_id: UUID,
    ch_dict: dict[str, Any],
    enriched_data: dict,
    tags: list[str],
) -> scheme.PlayerCharacterOut:
    character_id = ch_dict.get("id")
    if not character_id:
        raise HTTPException(status_code=400, detail="missing character id")

    payload = CharacterUpsertPayload.model_validate({
        **{k: v for k, v in ch_dict.items() if k not in ("data", "tags", "owned_items", "force")},
        "data": enriched_data,
        "tags": tags,
        "owned_items": ch_dict.get("owned_items") or [],
    })

    from app.routes._helpers import apply_item_ownership, validate_entity_data

    result = await validate_entity_data(
        db=db,
        entity="character",
        payload=EntityPayload(data=payload.data, tags=payload.tags or []),
        scenario_id=scenario_id,
    )
    if not result.ok and not payload.force:
        raise HTTPException(status_code=400, detail="Character validation failed")

    obj = (
        await db.execute(
            select(models.PlayerCharacter)
            .where(models.PlayerCharacter.id == character_id)
            .options(selectinload(models.PlayerCharacter.owned_item_links))
        )
    ).scalars().first()
    if not obj:
        raise HTTPException(status_code=404, detail="Персонаж не найден")

    update_fields = dump_entity_fields(
        payload,
        exclude={"owned_items"},
        exclude_unset=True,
        exclude_none=True,
    )
    update_fields["data"] = result.result.data
    update_fields["tags"] = result.result.tags
    for k, v in update_fields.items():
        setattr(obj, k, v)

    await db.commit()
    await db.refresh(obj)

    await apply_item_ownership(
        db,
        owner_id=obj.id,
        owner_type=models.OwnerTypeEnum.character,
        scenario_id=scenario_id,
        owned_items=payload.owned_items,
    )
    await db.commit()

    return scheme.PlayerCharacterOut.model_validate(obj)
