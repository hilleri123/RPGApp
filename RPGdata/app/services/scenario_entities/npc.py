from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app import models, scheme
from app.plugins.contracts import EntityPayload
from app.scheme.common import dump_entity_fields
from app.scheme.npc import NPCUpsertPayload


def _make_entity_payload(payload: NPCUpsertPayload) -> EntityPayload:
    return EntityPayload(
        data=payload.model_dump(mode="json")["data"],
        tags=payload.tags or [],
    )


async def _get_npc_or_404(db: AsyncSession, npc_id: UUID) -> scheme.NPCOut:
    obj = (
        await db.execute(
            select(models.NPC)
            .where(models.NPC.id == npc_id)
            .options(
                selectinload(models.NPC.owned_item_links).selectinload(models.ItemOwnership.item)
            )
        )
    ).scalars().first()
    if not obj:
        raise HTTPException(status_code=404, detail="NPC не найден")
    return scheme.NPCOut.model_validate(obj)


async def delete_npc(db: AsyncSession, *, npc_id: UUID) -> bool:
    obj = (await db.execute(select(models.NPC).where(models.NPC.id == npc_id))).scalars().first()
    if not obj:
        return False
    await db.delete(obj)
    await db.commit()
    return True


async def upsert_npc_from_ws_dict(
    db: AsyncSession,
    *,
    scenario_id: UUID,
    npc_dict: dict[str, Any],
    enriched_data: dict,
    tags: list[str],
    is_create: bool,
) -> scheme.NPCOut:
    payload_data = {
        **{k: v for k, v in npc_dict.items() if k not in ("data", "tags", "owned_items", "force")},
        "data": enriched_data,
        "tags": tags,
        "owned_items": npc_dict.get("owned_items") or [],
        "force": bool(npc_dict.get("force", False)),
    }
    if is_create and not payload_data.get("id"):
        from uuid import uuid4
        payload_data["id"] = str(uuid4())
    payload = NPCUpsertPayload.model_validate(payload_data)

    from app.routes._helpers import apply_item_ownership, validate_entity_data

    result = await validate_entity_data(
        db=db,
        entity="npc",
        payload=_make_entity_payload(payload),
        scenario_id=scenario_id,
    )
    if not result.ok and not payload.force:
        raise HTTPException(status_code=400, detail="NPC validation failed")

    plugin_data = result.result.model_dump(mode="json")
    entity_data = dump_entity_fields(payload, exclude={"owned_items"})
    for k in plugin_data:
        entity_data.pop(k, None)

    npc_id = payload.id
    copied_from = npc_dict.get("copied_from")
    if is_create:
        obj = models.NPC(
            **entity_data,
            **plugin_data,
            scenario_id=scenario_id,
            id=npc_id,
            copied_from=copied_from,
        )
        db.add(obj)
    else:
        obj = (await db.execute(select(models.NPC).where(models.NPC.id == npc_id))).scalars().first()
        if not obj:
            raise HTTPException(status_code=404, detail="NPC не найден")
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

    if payload.icon_url is not None:
        obj.icon_url = str(payload.icon_url)
    if payload.img_url is not None:
        obj.img_url = str(payload.img_url)

    await db.commit()
    await db.refresh(obj)

    await apply_item_ownership(
        db,
        owner_id=obj.id,
        owner_type=models.OwnerTypeEnum.npc,
        scenario_id=scenario_id,
        owned_items=payload.owned_items,
    )
    await db.commit()
    return await _get_npc_or_404(db, obj.id)
