from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
import bcrypt
from anyio import to_thread
from sqlalchemy.future import select

from app.infrastructure.database import get_async_session as get_db
from app import models, scheme

# Настройки JWT живут в app.infrastructure.settings — второго ключа здесь быть
# не должно, иначе подпись токенов зависит от того, кто какой импортировал.

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/token")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

async def verify_password_async(plain: str, hashed: str) -> bool:
    return await to_thread.run_sync(verify_password, plain, hashed)

def get_password_hash(password: str) -> str:
    """Хеширование пароля"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

async def get_user_by_full_name(db: AsyncSession, full_name: str) -> Optional[models.User]:
    """Получение пользователя по email"""
    stmt = select(models.User).where(models.User.full_name == full_name)
    result = await db.execute(stmt)
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail=f"Пользователь не зарегстрирован.")
    
    return user

async def create_user(db: AsyncSession, user: scheme.UserCreate) -> models.User:
    """Создание нового пользователя"""
    hashed_password = get_password_hash(user.password)
    db_user = models.User(
        email=user.email,
        hashed_password=hashed_password,
        full_name=user.full_name
    )
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    return db_user

async def authenticate_user(db: AsyncSession, full_name: str, password: str) -> Optional[models.User]:
    """Аутентификация пользователя"""
    user = await get_user_by_full_name(db, full_name)
    if not user:
        return None
    if not await verify_password_async(password, user.hashed_password):
        return None
    return user

