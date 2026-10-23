"""Инвентарь со списком участников. Предмет лежит в одной сумке."""

from __future__ import annotations

from uuid import UUID, uuid4

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory import Inventory, InventoryItem, InventoryParticipant


def _ptype(owner_type) -> str:
    return owner_type.value if hasattr(owner_type, "value") else str(owner_type)


async def sync_owner_inventory(
    db: AsyncSession,
    *,
    scenario_id: UUID,
    owner_type,
    owner_id: UUID,
    items: list[tuple[UUID, int, bool]],
) -> UUID:
    """Синхронизирует сумку участника с переданным составом.

    Если у сумки один участник, состав заменяется целиком.
    Если участников несколько, в сумку добавляются перечисленные предметы,
    чужие позиции общей сумки не стираются.
    """
    participant_type = _ptype(owner_type)
    found = (
        await db.execute(
            select(InventoryParticipant).where(
                InventoryParticipant.participant_type == participant_type,
                InventoryParticipant.participant_id == owner_id,
            )
        )
    ).scalars().all()

    if found:
        inventory_id = found[0].inventory_id
    else:
        inventory_id = uuid4()
        db.add(Inventory(id=inventory_id, scenario_id=scenario_id, name=""))
        db.add(
            InventoryParticipant(
                inventory_id=inventory_id,
                participant_type=participant_type,
                participant_id=owner_id,
            )
        )
        await db.flush()

    others = (
        await db.execute(
            select(func.count())
            .select_from(InventoryParticipant)
            .where(InventoryParticipant.inventory_id == inventory_id)
        )
    ).scalar_one()
    sole = int(others or 0) <= 1

    item_ids = [item_id for item_id, _, _ in items]
    if item_ids:
        await db.execute(
            delete(InventoryItem).where(
                InventoryItem.item_id.in_(item_ids),
                InventoryItem.inventory_id != inventory_id,
            )
        )

    if sole:
        await db.execute(delete(InventoryItem).where(InventoryItem.inventory_id == inventory_id))
    await db.flush()

    existing = (
        await db.execute(select(InventoryItem).where(InventoryItem.inventory_id == inventory_id))
    ).scalars().all()
    by_item = {row.item_id: row for row in existing}
    for item_id, qty, equipped in items:
        row = by_item.get(item_id)
        if row is None:
            db.add(InventoryItem(inventory_id=inventory_id, item_id=item_id, qty=qty, equipped=equipped))
        else:
            row.qty = qty
            row.equipped = equipped
    return inventory_id


async def add_participant(
    db: AsyncSession,
    inventory_id: UUID,
    participant_type: str,
    participant_id: UUID,
) -> None:
    """Общая сумка: ещё один участник, без новой таблицы. Состав предметов не трогаем."""
    existing = (
        await db.execute(
            select(InventoryParticipant).where(
                InventoryParticipant.inventory_id == inventory_id,
                InventoryParticipant.participant_type == participant_type,
                InventoryParticipant.participant_id == participant_id,
            )
        )
    ).scalars().first()
    if existing is not None:
        return
    db.add(
        InventoryParticipant(
            inventory_id=inventory_id,
            participant_type=participant_type,
            participant_id=participant_id,
        )
    )
