from aiogram import Router

from .link import router as link_router
from .lobby import router as lobby_router
from .join import router as join_router


def setup_routers() -> Router:
    root = Router()
    root.include_router(link_router)
    root.include_router(lobby_router)
    root.include_router(join_router)
    return root
