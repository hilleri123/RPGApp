from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError

from app.infrastructure.database import get_async_session as get_db
from app import models, scheme
from app.auth import require_master, require_admin

router = APIRouter(prefix="/access_groups", tags=["access_groups"])

_VALID_GROUP_MEMBER_PERMS = {p.value for p in scheme.RoleAccess}


async def _get_group_or_404(db: AsyncSession, group_id: UUID) -> models.MasterGroup:
    stmt = (
        select(models.MasterGroup)
        .options(selectinload(models.MasterGroup.users))
        .where(models.MasterGroup.id == group_id)
    )
    group = (await db.execute(stmt)).scalars().first()
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    return group


@router.get("/", response_model=List[scheme.MasterGroup])
@router.get("", response_model=List[scheme.MasterGroup])
async def get_all_groups(
    current_user: models.User = Depends(require_master),
    db: AsyncSession = Depends(get_db)
):
    """Список нужен мастеру, чтобы выдать группе доступ к своему сценарию."""
    stmt = (
        select(models.MasterGroup)
        .options(selectinload(models.MasterGroup.users))
    )
    result = await db.execute(stmt)
    groups = result.scalars().all()
    return [scheme.MasterGroup.model_validate(group) for group in groups]


@router.get("/{group_id}", response_model=scheme.MasterGroup)
async def get_group(
    group_id: UUID,
    current_user: models.User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Карточка группы отдаёт состав участников, поэтому только администратору."""
    stmt = (
        select(models.MasterGroup)
        .options(selectinload(models.MasterGroup.users))
        .where(models.MasterGroup.id == group_id)
    )
    result = await db.execute(stmt)
    group = result.scalars().first()

    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")

    return group


@router.post("/", response_model=scheme.MasterGroup)
@router.post("", response_model=scheme.MasterGroup)
async def create_group(
    group_data: scheme.MasterGroupCreate,
    current_user: models.User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    existing = (
        await db.execute(
            select(models.MasterGroup).where(models.MasterGroup.name == group_data.name)
        )
    ).scalars().first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Группа с таким именем уже существует",
        )

    group = models.MasterGroup(name=group_data.name)
    db.add(group)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Группа с таким именем уже существует",
        ) from exc
    await db.refresh(group)
    return scheme.MasterGroup.model_validate(group)



@router.patch("/{group_id}", response_model=scheme.MasterGroup)
async def update_group(
    group_id: UUID,
    data: scheme.MasterGroupCreate,
    current_user: models.User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(models.MasterGroup).where(models.MasterGroup.id == group_id)
    result = await db.execute(stmt)
    group = result.scalars().first()

    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")

    if data.name != group.name:
        duplicate = (
            await db.execute(
                select(models.MasterGroup).where(
                    models.MasterGroup.name == data.name,
                    models.MasterGroup.id != group_id,
                )
            )
        ).scalars().first()
        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Группа с таким именем уже существует",
            )

    group.name = data.name
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Группа с таким именем уже существует",
        ) from exc
    await db.refresh(group)
    return scheme.MasterGroup.model_validate(group)



@router.delete("/{group_id}")
async def delete_group(
    group_id: UUID,
    current_user: models.User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    group = await db.get(models.MasterGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")

    await db.delete(group)
    await db.commit()
    return {"message": "Группа успешно удалена"}


@router.post("/add_user", response_model=scheme.MasterGroup)
async def add_user_to_group(
    data: scheme.MasterGroupAddUser,
    current_user: models.User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    user = await db.get(models.User, data.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    await _get_group_or_404(db, data.group_id)

    existing = (
        await db.execute(
            select(models.UserMasterGroup).where(
                models.UserMasterGroup.user_id == data.user_id,
                models.UserMasterGroup.master_group_id == data.group_id,
            )
        )
    ).scalars().first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Пользователь уже состоит в этой группе",
        )

    # Уровень участника — потолок (min с правами группы на сценарий), по умолчанию не режем.
    permission = data.permission or scheme.RoleAccess.ALL_ROLE.value
    if permission not in _VALID_GROUP_MEMBER_PERMS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Недопустимый уровень прав: {permission}",
        )

    user_group = models.UserMasterGroup(
        user_id=data.user_id,
        master_group_id=data.group_id,
        permission=permission,
    )
    db.add(user_group)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Пользователь уже состоит в этой группе",
        ) from exc

    return await get_group(data.group_id, current_user=current_user, db=db)

@router.get("/{group_id}/member_levels", response_model=dict[str, str])
async def get_member_levels(
    group_id: UUID,
    current_user: models.User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """user_id -> уровень участника в группе (потолок прав на сценарии группы)."""
    rows = await db.execute(
        select(models.UserMasterGroup.user_id, models.UserMasterGroup.permission).where(
            models.UserMasterGroup.master_group_id == group_id
        )
    )
    return {str(uid): perm for uid, perm in rows.all()}


@router.post("/set_user_permission", response_model=dict[str, str])
async def set_user_permission(
    data: scheme.MasterGroupAddUser,
    current_user: models.User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    permission = data.permission or ""
    if permission not in _VALID_GROUP_MEMBER_PERMS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Недопустимый уровень прав: {permission}",
        )
    membership = (
        await db.execute(
            select(models.UserMasterGroup).where(
                models.UserMasterGroup.user_id == data.user_id,
                models.UserMasterGroup.master_group_id == data.group_id,
            )
        )
    ).scalars().first()
    if not membership:
        raise HTTPException(status_code=404, detail="Пользователь не найден в группе")
    membership.permission = permission
    await db.commit()
    return {"user_id": str(data.user_id), "permission": permission}


@router.post("/remove_user")
async def remove_user_from_group(
    data: scheme.MasterGroupAddUser,
    current_user: models.User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        delete(models.UserMasterGroup)
        .where(
            models.UserMasterGroup.user_id == data.user_id,
            models.UserMasterGroup.master_group_id == data.group_id
        )
    )
    result = await db.execute(stmt)
    await db.commit()

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Пользователь не найден в группе")

    return {"message": "Пользователь удален из группы"}

