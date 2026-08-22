from typing import Literal

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, Query

from app.auth import get_current_user
from app.managers import ChannelKey, observer_channels, session_manager
from app.logger import logger
from app import models, scheme


router = APIRouter(prefix="/session-obs", tags=["session"])

@router.get("/rooms", response_model=list[scheme.ObserverRoomPreview])
async def list_observer_rooms(
    search: str | None = Query(None, max_length=200),
    sort: Literal["name", "scenario", "master", "players", "created"] = "created",
    order: Literal["asc", "desc"] = "desc",
    current_user: models.User = Depends(get_current_user),
):
    # Сам вход зрителя по коду анонимный — так задумано. Но каталог отдаёт коды,
    # поэтому перечислять чужие идущие игры нельзя: показываем только свои.
    return await session_manager.list_observer_rooms(
        search=search,
        sort=sort,
        order=order,
        viewer=None if current_user.is_admin else current_user,
    )

@router.websocket("/ws/{code}")
async def ws_observer(websocket: WebSocket, code: str):
    key = ChannelKey(code=code)
    await observer_channels.connect(key, websocket)

    manager = await session_manager.get_manager_for_observer(code)
    if manager:
        data = await manager.build_observer_init(code)
        await observer_channels.broadcast_json(key, data.model_dump(mode='json'))
    else:
        logger.info(f"Manager for observer ({code}) not found")
    try:
        while True:
            raw = await websocket.receive_json()
            if (
                isinstance(raw, dict)
                and raw.get("msg_type") == "request_sync"
                and manager
            ):
                data = await manager.build_observer_init(code)
                await websocket.send_json(data.model_dump(mode="json"))
    except WebSocketDisconnect:
        pass
    finally:
        await observer_channels.disconnect(key, websocket)
