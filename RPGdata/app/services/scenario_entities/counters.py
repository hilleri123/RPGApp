from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, scheme


def clamp_counter_value(counter: models.Counter, value: int) -> int:
    if counter.min_value is not None and value < counter.min_value:
        value = int(counter.min_value)
    if counter.max_value is not None and value > counter.max_value:
        value = int(counter.max_value)
    return int(value)


def apply_counter_delta(counter: models.Counter, delta: int) -> tuple[int, int, int]:
    """Return (old_value, new_value, applied_delta) after clamp. Mutates counter.value."""
    old_value = int(counter.value or 0)
    new_value = clamp_counter_value(counter, old_value + int(delta))
    applied = new_value - old_value
    counter.value = new_value
    return old_value, new_value, applied


async def create_counter(
    db: AsyncSession,
    *,
    scenario_id: UUID,
    counter_in: scheme.CounterCreate,
    counter_id: UUID | None = None,
) -> models.Counter:
    db_counter = models.Counter(
        id=counter_id or uuid4(),
        **counter_in.model_dump(),
        scenario_id=scenario_id,
    )
    db.add(db_counter)
    await db.commit()
    await db.refresh(db_counter)
    return db_counter


async def delete_counter(
    db: AsyncSession,
    *,
    counter_id: UUID,
    scenario_id: UUID | None = None,
) -> bool:
    stmt = select(models.Counter).where(models.Counter.id == counter_id)
    if scenario_id is not None:
        stmt = stmt.where(models.Counter.scenario_id == scenario_id)
    obj = (await db.execute(stmt)).scalars().first()
    if not obj:
        return False
    await db.delete(obj)
    await db.commit()
    return True


async def record_counter_change(
    db: AsyncSession,
    *,
    counter: models.Counter,
    old_value: int,
    new_value: int,
    comment: str | None = None,
    user_id: UUID | None = None,
    commit: bool = False,
) -> models.CounterChange | None:
    if old_value == new_value:
        return None
    row = models.CounterChange(
        id=uuid4(),
        counter_id=counter.id,
        delta=int(new_value) - int(old_value),
        old_value=int(old_value),
        new_value=int(new_value),
        comment=comment,
        user_id=user_id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(row)
    if commit:
        await db.commit()
        await db.refresh(row)
    return row


async def adjust_counter(
    db: AsyncSession,
    *,
    counter: models.Counter,
    delta: int,
    comment: str | None = None,
    user_id: UUID | None = None,
) -> tuple[models.Counter, models.CounterChange | None]:
    old_value, new_value, _applied = apply_counter_delta(counter, delta)
    change = await record_counter_change(
        db,
        counter=counter,
        old_value=old_value,
        new_value=new_value,
        comment=comment,
        user_id=user_id,
    )
    await db.commit()
    await db.refresh(counter)
    if change is not None:
        await db.refresh(change)
    return counter, change


async def update_counter_value(
    db: AsyncSession,
    *,
    counter_id: UUID,
    value: int,
    comment: str | None = None,
    user_id: UUID | None = None,
    scenario_id: UUID | None = None,
) -> models.Counter | None:
    stmt = select(models.Counter).where(models.Counter.id == counter_id)
    if scenario_id is not None:
        stmt = stmt.where(models.Counter.scenario_id == scenario_id)
    obj = (await db.execute(stmt)).scalars().first()
    if not obj:
        return None
    old_value = int(obj.value or 0)
    new_value = clamp_counter_value(obj, int(value))
    if old_value == new_value:
        return None
    obj.value = new_value
    await record_counter_change(
        db,
        counter=obj,
        old_value=old_value,
        new_value=new_value,
        comment=comment,
        user_id=user_id,
    )
    await db.commit()
    await db.refresh(obj)
    return obj


async def list_counter_history(
    db: AsyncSession,
    *,
    counter_id: UUID,
    limit: int = 50,
) -> list[models.CounterChange]:
    res = await db.execute(
        select(models.CounterChange)
        .where(models.CounterChange.counter_id == counter_id)
        .order_by(models.CounterChange.created_at.desc())
        .limit(limit)
    )
    return list(res.scalars().all())
