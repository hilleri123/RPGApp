from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import or_


from app import models
from app import scheme
from app.auth.auth_service import get_password_hash, verify_password_async
from app.auth.user import get_current_user
from app.auth.role import require_admin
from app.infrastructure.database import get_async_session as get_db

router = APIRouter(
    prefix="/users",
    tags=["users"]
)

# --- Просмотр всех зарегистрированных пользователей ---
# Приложение поднято с redirect_slashes=False, поэтому путь без слеша регистрируется явно.
@router.get("", response_model=List[scheme.User])
@router.get("/", response_model=List[scheme.User])
async def list_users(
    skip: int = 0,
    limit: int = 100,
    q: Optional[str] = None,
    current_user: models.User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(models.User)
    if q and q.strip():
        pattern = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                models.User.full_name.ilike(pattern),
                models.User.email.ilike(pattern),
                models.User.tg.ilike(pattern),
            )
        )
    stmt = stmt.order_by(models.User.full_name.asc().nulls_last()).offset(skip).limit(limit)
    users = await db.execute(stmt)
    return [scheme.User.model_validate(u, from_attributes=True) for u in users.scalars().all()]

# --- Просмотр собственного профиля ---
@router.get("/me", response_model=scheme.User)
async def get_me(
    current_user: models.User = Depends(get_current_user)
):
    return scheme.User.model_validate(current_user)


def _roll_out(row: models.RollRecord) -> scheme.RollRecordOut:
    return scheme.RollRecordOut(
        id=row.id,
        session_id=row.session_id,
        user_id=row.user_id,
        action_id=row.action_id,
        action_key=row.action_key,
        roll_kind=row.roll_kind or "dice.roll",
        system_id=row.system_id,
        title=row.title,
        expression=row.expression,
        dice=list(row.dice or []),
        total=row.total,
        outcome=row.outcome,
        seed_hash=row.seed_hash,
        # Auth-gated URL (FE same-origin /api proxy + cookies).
        seed_image_url=(f"/api/users/me/rolls/{row.id}/seed" if row.seed_image_ref else None),
        meta=dict(row.meta or {}),
        created_at=row.created_at,
    )


@router.get("/me/rolls", response_model=scheme.RollListOut)
async def list_my_rolls(
    skip: int = 0,
    limit: int = 50,
    session_id: Optional[UUID] = None,
    roll_kind: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import func

    limit = max(1, min(limit, 200))
    skip = max(0, skip)

    filters = [models.RollRecord.user_id == current_user.id]
    if session_id is not None:
        filters.append(models.RollRecord.session_id == session_id)
    if roll_kind:
        filters.append(models.RollRecord.roll_kind == roll_kind)

    total = (
        await db.execute(select(func.count()).select_from(models.RollRecord).where(*filters))
    ).scalar_one()

    rows = (
        await db.execute(
            select(models.RollRecord)
            .where(*filters)
            .order_by(models.RollRecord.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
    ).scalars().all()

    kind_rows = (
        await db.execute(
            select(models.RollRecord.roll_kind, func.count())
            .where(models.RollRecord.user_id == current_user.id)
            .group_by(models.RollRecord.roll_kind)
        )
    ).all()
    by_kind = {str(k or "dice.roll"): int(c) for k, c in kind_rows}

    avg_total = (
        await db.execute(
            select(func.avg(models.RollRecord.total)).where(
                models.RollRecord.user_id == current_user.id,
                models.RollRecord.total.is_not(None),
            )
        )
    ).scalar_one()

    with_seed = (
        await db.execute(
            select(func.count()).select_from(models.RollRecord).where(
                models.RollRecord.user_id == current_user.id,
                models.RollRecord.seed_image_ref.is_not(None),
            )
        )
    ).scalar_one()

    return scheme.RollListOut(
        items=[_roll_out(r) for r in rows],
        stats=scheme.RollStatsOut(
            total_rolls=int(total or 0),
            by_kind=by_kind,
            avg_total=float(avg_total) if avg_total is not None else None,
            with_seed_image=int(with_seed or 0),
        ),
        total=int(total or 0),
        skip=skip,
        limit=limit,
    )


@router.get("/me/rolls/{roll_id}", response_model=scheme.RollRecordOut)
async def get_my_roll(
    roll_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(models.RollRecord, roll_id)
    if not row or row.user_id != current_user.id:
        raise HTTPException(404, "Бросок не найден")
    return _roll_out(row)


@router.get("/me/rolls/{roll_id}/seed")
async def get_my_roll_seed(
    roll_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from fastapi.responses import FileResponse
    from app.services.roll_persist import seed_image_path

    row = await db.get(models.RollRecord, roll_id)
    if not row or row.user_id != current_user.id:
        raise HTTPException(404, "Бросок не найден")
    path = seed_image_path(row.seed_image_ref)
    if path is None or not path.exists():
        raise HTTPException(404, "Seed-изображение не найдено")
    return FileResponse(path, media_type="image/png")


# --- Просмотр профиля другого пользователя ---
@router.get("/{user_id}", response_model=scheme.User)
async def get_user(
    user_id: UUID, 
    current_user: models.User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    user = await db.get(models.User, user_id)
    if not user:
        raise HTTPException(404, "Пользователь не найден")
    return scheme.User.model_validate(user)

# --- Редактирование профиля текущего пользователя ---
@router.put("/me", response_model=scheme.UserWithGroups)
async def update_me(
    user_patch: scheme.UserSelfUpdate,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    new_password = user_patch.new_password
    old_password = user_patch.old_password

    if new_password:
        if current_user.hashed_password:
            if not old_password:
                raise HTTPException(
                    status_code=400,
                    detail="Необходимо указать текущий пароль для смены."
                )
            if not await verify_password_async(old_password, current_user.hashed_password):
                raise HTTPException(
                    status_code=400,
                    detail="Неверный текущий пароль."
                )
        current_user.hashed_password = get_password_hash(new_password)

    for k, v in user_patch.model_dump(mode='json', exclude_unset=True, exclude={"old_password", "new_password"}).items():
        setattr(current_user, k, v)

    await db.commit()
    await db.refresh(current_user)
    return scheme.User.model_validate(current_user)


# --- Админская ручка для изменения полей у другого пользователя ---
@router.patch("/{user_id}", response_model=scheme.User)
async def admin_update_user(
    user_id: UUID,
    user_patch: scheme.UserUpdate,
    current_user: models.User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    user = await db.get(models.User, user_id)
    if not user:
        raise HTTPException(404, "Пользователь не найден")

    patch = user_patch.model_dump(
        mode="json",
        exclude_unset=True,
        exclude={"id", "old_password", "new_password"},
    )

    # Иначе последний администратор может случайно разжаловать сам себя и потерять доступ.
    if user.id == current_user.id and patch.get("is_admin") is False:
        raise HTTPException(400, "Нельзя снять права администратора с самого себя")

    for k, v in patch.items():
        setattr(user, k, v)

    if user_patch.new_password:
        user.hashed_password = get_password_hash(user_patch.new_password)

    await db.commit()
    await db.refresh(user)
    return scheme.User.model_validate(user)


@router.get("/{user_id}/groups", response_model=List[scheme.MasterGroup])
async def get_user_groups(
    user_id: UUID,
    current_user: models.User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    # Загружаем пользователя с группами сразу (eager loading)
    stmt = (
        select(models.User)
        .options(
            selectinload(models.User.master_groups)
            .selectinload(models.MasterGroup.users)
        )
        .where(models.User.id == user_id)
    )
    result = await db.execute(stmt)
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    return [scheme.MasterGroup.model_validate(group) for group in user.master_groups]
