from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy import event, DDL
import os

from .settings import settings

# PostgreSQL engine
engine = create_async_engine(settings.sqlalchemy_database_url)
AsyncSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()

event.listen(
    Base.metadata,
    "before_create",
    DDL("CREATE SCHEMA IF NOT EXISTS rule")
)

event.listen(
    Base.metadata,
    "before_create",
    DDL("CREATE SCHEMA IF NOT EXISTS scenario")
)


async def get_async_session() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session

async def create_tables():
    """Асинхронное создание таблиц"""
    async with engine.begin() as conn:
        # Для использования metadata.create_all
        await conn.run_sync(Base.metadata.create_all)
