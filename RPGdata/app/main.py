import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from contextlib import asynccontextmanager
import asyncio
from logging.config import dictConfig

from app.infrastructure.database import create_tables, AsyncSessionLocal
from app.infrastructure.settings import settings
from app.routes import routers
from app.infrastructure.redis_service import redis_listener
from app.logger import LOG_CONFIG


@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(redis_listener())

    from app.infrastructure.rabbitmq import start_bot_rpc_consumer, stop_bot_rpc_consumer

    await start_bot_rpc_consumer()
    try:
        yield
    finally:
        await stop_bot_rpc_consumer()


dictConfig(LOG_CONFIG)

app = FastAPI(
    title="RPG Game API",
    redirect_slashes=False,
    lifespan=lifespan,
    root_path=os.environ.get("ROOT_PATH", '/api')
)

# Configure CORS
# Со allow_credentials=True звёздочка запрещена спецификацией: браузер отбросит
# такой ответ, а где не отбросит — любой сайт сможет ходить в API с куками
# пользователя. Аутентификация здесь целиком на куках, поэтому список явный.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Схему БД накатывает alembic (см. migrate.sh), на старте приложения ничего
# не создаём.

# Include routers
for router in routers:
    app.include_router(router)


@app.get("/health", include_in_schema=False)
async def health():
    """Liveness для healthcheck в compose. Намеренно не трогает БД и Redis:
    задача — отличить живой процесс от повисшего, а не проверить зависимости."""
    return {"status": "ok"}



MEDIA_ROOT = Path("/app/media")
MEDIA_ROOT.mkdir(parents=True, exist_ok=True)

app.mount("/media", StaticFiles(directory=str(MEDIA_ROOT)), name="media")