from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
import jwt
import hmac
import hashlib
import urllib.parse
import time
import json


from app.infrastructure.settings import settings
from app.models.user import User
from app.scheme.auth import RefreshAccessToken, JWTPayLoad, TelegramAuthData, TelegramUser
from app.auth.auth_dt import get_moscow_expiration
from app.auth.user_service import UserService

security = HTTPBearer()


def _access_token_exp() -> int:
    return int(
        (
            datetime.now(timezone.utc)
            + timedelta(hours=settings.access_token_lifetime_hours)
        ).timestamp()
    )


def _refresh_token_exp() -> int:
    return int(
        (
            datetime.now(timezone.utc)
            + timedelta(days=settings.refresh_token_lifetime_days)
        ).timestamp()
    )


class TokenManager:
    """Менеджер токенов"""
    secret_key: str = settings.secret_key
    algorithm: str = settings.algorithm
    refresh_token_expire_days: int = settings.refresh_token_lifetime_days
    access_token_expire_hours: int = settings.access_token_lifetime_hours

    def create_tokens(self, data: User) -> RefreshAccessToken:
        """Создание пары токенов (аксесс и рефреш) на основе User."""
        access_token = self.create_access_token(data)
        refresh_token = self.create_refresh_token(data)

        access_payload = jwt.decode(access_token, self.secret_key, algorithms=[self.algorithm], options={"verify_signature": False})
        refresh_payload = jwt.decode(refresh_token, self.secret_key, algorithms=[self.algorithm], options={"verify_signature": False})

        return RefreshAccessToken(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            access_token_expires_at=datetime.fromtimestamp(access_payload["exp"]),
            refresh_token_expires_at=datetime.fromtimestamp(refresh_payload["exp"])
        )

    def create_access_token(self, data: User) -> str:
        """Создание аксесс-токена."""
        token_payload = JWTPayLoad(
            user_id=str(data.id),
            tg=data.tg,
            full_name=data.full_name,
            exp=_access_token_exp(),
            token_type="access"
        )
        return jwt.encode(token_payload.model_dump(mode="json"), self.secret_key, algorithm=self.algorithm)

    def create_refresh_token(self, data: User) -> str:
        """Создание рефреш-токена."""
        token_payload = JWTPayLoad(
            user_id=str(data.id),
            tg=data.tg,
            full_name=data.full_name,
            exp=_refresh_token_exp(),
            token_type="refresh"
        )

        return jwt.encode(token_payload.model_dump(mode="json"), self.secret_key, algorithm=self.algorithm)

    async def refresh_access_token(self, session: AsyncSession, refresh_token: str) -> RefreshAccessToken:
        """Обновление аксесс-токена по рефреш-токену."""
        try:
            payload = jwt.decode(refresh_token, self.secret_key, algorithms=[self.algorithm])
            if payload.get("token_type") != "refresh":
                raise HTTPException(status_code=401, detail="Invalid refresh token")

            user_service = UserService(session=session)
            user = await user_service.get_user_by_id(payload.get('user_id'))

            new_access = self.create_access_token(user)
            new_refresh = self.create_refresh_token(user)
            access_payload = jwt.decode(
                new_access, self.secret_key, algorithms=[self.algorithm], options={"verify_signature": False}
            )
            refresh_payload = jwt.decode(
                new_refresh, self.secret_key, algorithms=[self.algorithm], options={"verify_signature": False}
            )

            return RefreshAccessToken(
                access_token=new_access,
                refresh_token=new_refresh,
                token_type="bearer",
                access_token_expires_at=datetime.fromtimestamp(access_payload["exp"], tz=timezone.utc),
                refresh_token_expires_at=datetime.fromtimestamp(refresh_payload["exp"], tz=timezone.utc),
            )
        
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Refresh token expired")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Invalid refresh token")


def decode_jwt(token:str) -> JWTPayLoad:
    """Проверка access token !! пока не проверяю тут date_expiration !!"""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        if payload.get("token_type") == "refresh":
            raise HTTPException(status_code=401, detail="Invalid token: refresh token cannot be used for API requests")
        return JWTPayLoad(**payload)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError as e:
        # print(f"Invalid token error: {str(e)}")
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


def verify_jwt(token: str) -> JWTPayLoad:
    """Проверка access token !! пока не проверяю тут date_expiration !!"""
    try:
        # print(credentials.model_dump(mode="json"))
        return decode_jwt(token=token)
        # print(token)
        # payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        # print(f"Decoded payload: {payload}")
        # if "refresh" in payload.get("token_type") == "refresh":
        #     raise HTTPException(status_code=401, detail=f"Invalid token: Нехуй использовать refresh token для запросов")
        # else:
        #     return JWTPayLoad(**payload)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError as e:
        # print(f"Invalid token error: {str(e)}")
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")



def verify_telegram_webapp(init_data, bot_token=settings.bot_token) -> TelegramAuthData:
    """Проверка, что у нас свежая аутентификация от пользака из InitData Телеграм"""
    parsed_data = dict(urllib.parse.parse_qsl(init_data))

    
    auth_date = parsed_data.get("auth_date", time.time())
    current_timestamp = time.time()

    # auth_date + сутки должно быть больше чем текущее время
    session_not_expired = int(current_timestamp) < int(auth_date) + 60*15
    
    if not session_not_expired:
        raise HTTPException(status_code=400, detail="Authorization data expired")
    
    # Забрали хеш
    received_hash = parsed_data.pop('hash', None)

    if not received_hash:
        raise HTTPException(status_code=400, detail="No hash in InitData")
    # Сортируем параметры по ключу и собираем строку
    data_check_string = '\n'.join(f"{key}={value}" for key, value in sorted(parsed_data.items()))
    
    # Секретный ключ с использованием токена бота
    secret_key = hmac.new("WebAppData".encode(), bot_token.encode(), hashlib.sha256).digest()
    
    # Генерируем хэш строки data_check_string
    calculated_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    
    # Сравниваем полученный хэш с тем, что пришёл в init_data
    if not hmac.compare_digest(calculated_hash, received_hash):
        raise HTTPException(status_code=400, detail="Invalid hash")
    
    user_data = json.loads(parsed_data['user'])
    telegram_user = TelegramUser(**user_data)
    
    # Удаляем из parsed_data поле 'user', так как оно уже обработано
    del parsed_data['user']
    
    telegram_auth_data = TelegramAuthData(telegram_user, **parsed_data)
    
    return telegram_auth_data

