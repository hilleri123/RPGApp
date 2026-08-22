from fastapi import Cookie, Depends, HTTPException, WebSocket, WebSocketException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Optional




from .auth_utils import verify_jwt, decode_jwt
from app.infrastructure.database import get_async_session
from app.models.user import User
from app.logger import logger

security = HTTPBearer()

PREFIX = "Bearer "


async def get_user_by_token(
        token: str
        ):
    async for db in get_async_session():
        if token.startswith(PREFIX):
            token = token[len(PREFIX):]
        user_id = decode_jwt(token=token).user_id
        stmt = select(User).where(User.id == user_id)
        result = await db.execute(stmt)
        user = result.scalars().first()

        if not user:
            raise HTTPException(status_code=404, detail=f"Пользователь не зарегстрирован.")
        
        return user



async def get_current_user(
    access_token: str = Cookie(None),  # читаем из cookie
    db: AsyncSession = Depends(get_async_session)
) -> User:
    if not access_token:
        raise HTTPException(status_code=401, detail="Не авторизован")
    
    user_id = verify_jwt(access_token).user_id  # передаём строку, не credentials
    
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не зарегистрирован")
    
    return user



# auth/user.py — новая версия get_current_user_ws
async def get_current_user_ws(
    websocket: WebSocket,
    db: AsyncSession,
) -> User:
    logger.info(f"WS cookies: {dict(websocket.cookies)}")  # ← смотрим что приходит
    # Читаем access_token из cookie WebSocket handshake запроса
    access_token = websocket.cookies.get("access_token")
    
    if not access_token:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)
    
    try:
        user_id = verify_jwt(access_token).user_id
    except Exception as e:
        logger.error(f"verify_jwt failed: {e}")  # ← добавь это
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)
    
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalars().first()
    
    if not user:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)
    
    return user