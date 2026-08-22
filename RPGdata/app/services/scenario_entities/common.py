"""Shared DB helpers for scenario entity services."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import TypeVar

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database import get_async_session as get_db

T = TypeVar("T")


async def with_db(fn: Callable[[AsyncSession], Awaitable[T]]) -> T:
    """Run ``fn`` inside a DB session and always close the generator."""
    gen = get_db()
    try:
        db = await gen.__anext__()
        return await fn(db)
    finally:
        await gen.aclose()
