from typing import Optional
from pydantic import BaseModel, EmailStr, Field, HttpUrl
from dataclasses import dataclass, field
from typing import Optional, Dict
from datetime import datetime, timezone
from uuid import UUID


class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class UserBase(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None

class UserCreate(UserBase):
    password: str


class User(UserBase):
    id: UUID
    is_admin: bool = False
    can_be_master: bool = False
    is_active: bool = True
    telegram_id: Optional[int] = None

    icon_url: Optional[HttpUrl] = None
    img_url: Optional[HttpUrl] = None

    class Config:
        from_attributes = True 

class UserUpdate(User):
    """Админская правка пользователя: сюда входят и роли."""
    id: Optional[UUID] = None
    new_password: Optional[str] = None
    old_password: Optional[str] = None


class UserSelfUpdate(BaseModel):
    """Правка собственного профиля. Роли и id недоступны намеренно:
    поля этой схемы присваиваются объекту пользователя без дополнительной фильтрации."""
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    icon_url: Optional[HttpUrl] = None
    img_url: Optional[HttpUrl] = None
    new_password: Optional[str] = None
    old_password: Optional[str] = None

# -------------------Matvei

class TelegramUser(BaseModel):
    id: int
    is_bot: bool
    first_name: str
    last_name: Optional[str]
    username: Optional[str]
    language_code: Optional[str]
    is_premium: Optional[bool]
    added_to_attachment_menu: Optional[bool]
    photo_url: Optional[str]
    allows_write_to_pm: Optional[bool]


    class Config:
        extra = "allow"


class WebAppData(BaseModel):
    initData: str
    initDataUnsafe: Optional[TelegramUser] = None
    
    class Config:
        extra = "allow"  # Позволяет игнорировать дополнительные поля


class LinkAuthIn(BaseModel):
    token: str




class JWTPayLoad(BaseModel):
    """PayLoad from JWT"""
    user_id: UUID
    tg: Optional[str] = None
    full_name: str
    exp: int
    token_type: str

class Bearer(BaseModel):
    access_token: str
    token_type: str = "bearer"
    access_token_expires_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    

class RefreshAccessToken(Bearer):
    refresh_token: str
    refresh_token_expires_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserRefreshAccessToken(RefreshAccessToken):
    user: User


"""Это все что лежит в payload после того как я верифицирую сессию в тг"""
@dataclass
class TelegramUser:
    """Данные пользователя Telegram."""
    id: int
    first_name: str
    language_code: str
    allows_write_to_pm: bool
    last_name: Optional[str] = None
    username: Optional[str] = None
    photo_url: Optional[str] = None
    is_premium: Optional[bool] = None

@dataclass
class TelegramAuthData:
    """Данные аутентификации Telegram."""
    user: TelegramUser
    auth_date: int
    signature: str
    query_id: Optional[str] = None # какое то дерьмо 
    chat_instance: Optional[str] = None # какое то дерьмо 
    chat_type: Optional[str] = None # какое то дерьмо 
