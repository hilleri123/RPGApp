import os
from pydantic_settings import BaseSettings

from app.logger import logger

# Единственный источник ключа подписи JWT. Значение по умолчанию пригодно
# только для локальной разработки.
DEFAULT_SECRET_KEY = 'your-secret-key-change-in-production'


def resolve_cookie_secure(raw: str | None, env: str) -> bool:
    """Явное значение COOKIE_SECURE важнее; иначе по окружению."""
    if raw is None or raw == '':
        return env == 'production'
    return raw.strip().lower() in ('1', 'true', 'yes', 'on')


class Settings(BaseSettings):
    database_name: str = "game_sessions_db"
    sqlalchemy_database_url: str = f"postgresql+asyncpg://{os.getenv('POSTGRES_USER', 'postgres')}:{os.getenv('POSTGRES_PASSWORD', 'postgres')}@db:5432/{os.getenv('POSTGRES_DB', 'rpg_sessions')}"
    env: str = os.getenv('ENV', 'development')
    secret_key: str = os.getenv('SECRET_KEY', DEFAULT_SECRET_KEY)
    algorithm: str = os.getenv('ALGORITHM', 'HS256')
    bot_token: str = os.getenv('BOT_TOKEN', '')
    access_token_lifetime_hours: int = 72
    refresh_token_lifetime_days: int = 14
    # Флаг secure на куках с токенами. В проде включён по умолчанию, локально
    # выключен: по http браузер secure-куку просто не сохранит и логин отвалится.
    cookie_secure: bool = resolve_cookie_secure(
        os.getenv('COOKIE_SECURE'), os.getenv('ENV', 'development')
    )

    # Origin-ы для CORS: список через запятую в CORS_ORIGINS. Дефолт — локальная
    # разработка; в проде домен задаётся переменной окружения.
    cors_origins_raw: str = os.getenv(
        'CORS_ORIGINS', 'http://localhost:3000,http://localhost:6602,http://127.0.0.1:3000'
    )

    class Config:
        env_file = ".env"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins_raw.split(',') if o.strip()]

def validate_secret_key(secret_key: str, env: str) -> None:
    """В production дефолтный или пустой ключ подписи запрещён.

    Пустая строка — реальный сценарий: compose подставляет ${SECRET_KEY},
    и без переменной в окружении получается '', а не значение по умолчанию.
    """
    if secret_key and secret_key != DEFAULT_SECRET_KEY:
        return
    if env == 'production':
        raise RuntimeError(
            "SECRET_KEY не задан. Дефолтный ключ опубликован в репозитории — "
            "подписанный им JWT подделает кто угодно. Задайте SECRET_KEY в окружении."
        )
    logger.warning(
        "SECRET_KEY не задан, используется небезопасный ключ. Допустимо только для разработки."
    )


settings = Settings()

validate_secret_key(settings.secret_key, settings.env)
