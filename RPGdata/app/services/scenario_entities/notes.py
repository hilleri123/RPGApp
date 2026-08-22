from __future__ import annotations

from uuid import UUID, uuid4

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, scheme


async def create_note(
    db: AsyncSession,
    *,
    scenario_id: UUID,
    note_in: scheme.NoteCreate,
    note_id: UUID | None = None,
    owner_user_id: UUID | None = None,
    owner_role: str | None = None,
) -> models.Note:
    payload = note_in.model_dump(
        exclude={"is_checked", "owner_user_id", "owner_role"},
        mode="json",
    )
    db_note = models.Note(
        id=note_id or uuid4(),
        **payload,
        scenario_id=scenario_id,
        owner_user_id=owner_user_id,
        owner_role=owner_role,
    )
    db.add(db_note)
    await db.commit()
    await db.refresh(db_note)
    return db_note


async def delete_note(db: AsyncSession, *, note_id: UUID) -> bool:
    obj = (await db.execute(select(models.Note).where(models.Note.id == note_id))).scalars().first()
    if not obj:
        return False
    await db.delete(obj)
    await db.commit()
    return True


async def update_note(
    db: AsyncSession,
    *,
    note_id: UUID,
    note_in: scheme.NoteCreate,
) -> models.Note | None:
    obj = (await db.execute(select(models.Note).where(models.Note.id == note_id))).scalars().first()
    if not obj:
        return None
    for k, v in note_in.model_dump(
        exclude={"is_checked", "owner_user_id", "owner_role"},
        mode="json",
    ).items():
        setattr(obj, k, v)
    await db.commit()
    await db.refresh(obj)
    return obj


async def update_note_checked(
    db: AsyncSession,
    *,
    note_id: UUID,
    is_checked: bool,
) -> bool:
    obj = (await db.execute(select(models.Note).where(models.Note.id == note_id))).scalars().first()
    if not obj:
        return False
    tags = dict(obj.tags or {})
    tags["is_checked"] = is_checked
    obj.tags = tags
    await db.commit()
    return True
