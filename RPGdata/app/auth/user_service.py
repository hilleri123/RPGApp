# logic/user_service.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from app.models.user import User
from app.scheme.auth import TelegramAuthData, TelegramUser
import uuid


class UserNotFoundException(Exception):
    pass




class UserService:
    """Joined по сути тот пользователь, 
    что просто зашел к нам в приложение, 
    это не значит, что он прошел регистрацию"""
    def __init__(self, session: AsyncSession):
        self.session = session

    async def check_user_exists(self, telegram_id: int):
        """Проверка существования пользователя по telegram_id."""
        query = select(User).filter_by(telegram_id=telegram_id)
        result = await self.session.execute(query)
        user = result.scalar_one_or_none()
        # return user is not None
        return user 

    async def create_joined_user(self, telegram_user: TelegramUser) -> User:
        """Найти или создать пользователя; привязать telegram_id к аккаунту по @username."""
        user = await self.check_user_exists(telegram_user.id)
        if user:
            if telegram_user.username and user.tg != telegram_user.username:
                user.tg = telegram_user.username
                await self.session.commit()
                await self.session.refresh(user)
            return user

        if telegram_user.username:
            result = await self.session.execute(
                select(User).where(
                    func.lower(User.tg) == telegram_user.username.lower()
                )
            )
            existing = result.scalar_one_or_none()
            if existing:
                if existing.telegram_id is None:
                    existing.telegram_id = telegram_user.id
                    if telegram_user.first_name:
                        existing.full_name = (
                            f"{telegram_user.first_name} {telegram_user.last_name or ''}".strip()
                        )
                    await self.session.commit()
                    await self.session.refresh(existing)
                    return existing
                if existing.telegram_id == telegram_user.id:
                    return existing

        new_user = User(
            telegram_id=telegram_user.id,
            full_name=f"{telegram_user.first_name} {telegram_user.last_name or ''}".strip(),
            tg=telegram_user.username,
            img_url=telegram_user.photo_url,
        )

        self.session.add(new_user)
        await self.session.commit()
        await self.session.refresh(new_user)
        return new_user

    async def create_user_from_auth_data(self, auth_data: TelegramAuthData) -> User:
        """Создание нового пользователя на основе TelegramAuthData."""
        return await self.create_joined_user(auth_data.user)

    async def get_user_by_id(self, user_id: str) -> User:
        result = await self.session.execute(select(User).where(User.id == uuid.UUID(user_id)))
        user = result.scalars().first()
        if not user:
            raise UserNotFoundException(f"User with id {user_id} not found")
        return user

