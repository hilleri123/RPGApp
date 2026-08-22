from fastapi import HTTPException, Depends, APIRouter, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi.security import OAuth2PasswordRequestForm
from fastapi import Cookie

from app.infrastructure.settings import settings

from app.scheme.auth import WebAppData, RefreshAccessToken, UserRefreshAccessToken, LinkAuthIn#, Bearer, JWTPayLoad
from app.auth.auth_utils import verify_telegram_webapp, TokenManager, TelegramUser
from app.infrastructure.database import get_async_session as get_db
from app.auth.user_service import UserService
from app import models, scheme
from app.auth import auth_service, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


MAX_AGE = 60 * 60 * 24 * 7
REFRESH_MAX_AGE = 60 * 60 * 24 * 30


def _set_auth_cookies(response: Response, tokens) -> None:
    response.set_cookie(
        "access_token",
        tokens.access_token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
        max_age=MAX_AGE,
    )
    response.set_cookie(
        "refresh_token",
        tokens.refresh_token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
        max_age=REFRESH_MAX_AGE,
    )


@router.post("/telegram", response_model=UserRefreshAccessToken)
async def authenticate(data: WebAppData, db: AsyncSession = Depends(get_db), response: Response = None):
    parsed_data = verify_telegram_webapp(data.initData)
    pg_users_service = UserService(db)
    user = await pg_users_service.create_user_from_auth_data(parsed_data)
    token_manager = TokenManager()
    tokens = token_manager.create_tokens(user)

    _set_auth_cookies(response, tokens)

    return UserRefreshAccessToken(
        **tokens.model_dump(mode="json"),
        user=user,
    )


@router.post("/link", response_model=UserRefreshAccessToken)
async def authenticate_link(
    data: LinkAuthIn,
    db: AsyncSession = Depends(get_db),
    response: Response = None,
):
    from app.services.telegram_link_service import consume_link_token

    payload = await consume_link_token(data.token)
    if not payload:
        raise HTTPException(status_code=401, detail="Ссылка устарела")

    tg_user = TelegramUser(
        id=int(payload["telegram_id"]),
        first_name=payload.get("first_name") or "Игрок",
        last_name=payload.get("last_name"),
        username=payload.get("username"),
        language_code="ru",
        allows_write_to_pm=True,
    )
    pg_users_service = UserService(db)
    user = await pg_users_service.create_joined_user(tg_user)
    username = payload.get("username")
    if username and user.tg != username:
        user.tg = username
        await db.commit()
        await db.refresh(user)

    token_manager = TokenManager()
    tokens = token_manager.create_tokens(user)
    _set_auth_cookies(response, tokens)
    return UserRefreshAccessToken(
        **tokens.model_dump(mode="json"),
        user=user,
    )


@router.post("/login", response_model=UserRefreshAccessToken)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
    response: Response = None,
):
    user = await auth_service.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token_manager = TokenManager()
    tokens = token_manager.create_tokens(user)

    _set_auth_cookies(response, tokens)

    return UserRefreshAccessToken(
        **tokens.model_dump(mode="json"),
        user=user,
    )



@router.post("/distribution")
async def add_future_user_to_distribution(data: WebAppData, db: AsyncSession = Depends(get_db)):
    print(data)
    parsed_data = verify_telegram_webapp(data.initData)
    pg_users_service = UserService(db)
    user = await pg_users_service.create_user_from_auth_data(parsed_data)
    return user
    
@router.post("/refresh/token", response_model=RefreshAccessToken)
async def refresh_authentication(
    refresh_token: str = Cookie(None),
    db: AsyncSession = Depends(get_db),
    response: Response = None,
):
    if not refresh_token:  # ← добавить
        raise HTTPException(status_code=401, detail="Refresh token отсутствует")
    token_manager = TokenManager()
    tokens = await token_manager.refresh_access_token(session=db, refresh_token=refresh_token)

    _set_auth_cookies(response, tokens)
    return tokens


@router.post("/register", response_model=scheme.User)
async def register_user(user: scheme.UserCreate, db: AsyncSession = Depends(get_db)):
    """Регистрация нового пользователя"""
    # full_name — логин: authenticate_user ищет пользователя именно по нему,
    # поэтому тёзка не просто дубликат, а пользователь, который не сможет войти.
    existing = (await db.execute(
        select(models.User).where(models.User.full_name == user.full_name)
    )).scalars().first()
    if existing:
        raise HTTPException(status_code=400, detail="Это имя уже занято")

    if user.email:
        existing_email = (await db.execute(
            select(models.User).where(models.User.email == user.email)
        )).scalars().first()
        if existing_email:
            raise HTTPException(status_code=400, detail="Email уже зарегистрирован")

    return await auth_service.create_user(db=db, user=user)



@router.get("/me", response_model=scheme.User)
async def me(
    current_user: models.User = Depends(get_current_user)
    ):
    return current_user



@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}


