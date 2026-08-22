from __future__ import annotations

from uuid import UUID

from fastapi import WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from app.logger import logger


def _is_connected(websocket: WebSocket) -> bool:
    return websocket.client_state == WebSocketState.CONNECTED


def is_websocket_gone(exc: BaseException) -> bool:
    if isinstance(exc, WebSocketDisconnect):
        return True
    if isinstance(exc, RuntimeError):
        msg = str(exc)
        return (
            "WebSocket is not connected" in msg
            or 'Cannot call "send" once a close message has been sent' in msg
        )
    return False


async def _safe_close(websocket: WebSocket, code: int = 1000) -> None:
    if not _is_connected(websocket):
        return
    try:
        await websocket.close(code=code)
    except (RuntimeError, AttributeError, WebSocketDisconnect) as exc:
        logger.debug("websocket close skipped: %s", exc)
    except Exception as exc:
        logger.warning("websocket close failed: %s", exc)


class ConnectionManager:
    """Multiple sockets per client_id (e.g. main window + scene popouts)."""

    def __init__(self):
        self.active_connections: dict[UUID, set[WebSocket]] = {}

    async def connect(self, client_id: UUID, websocket: WebSocket):
        bucket = self.active_connections.setdefault(client_id, set())
        bucket.add(websocket)

    async def disconnect(self, client_id: UUID, websocket: WebSocket | None = None):
        bucket = self.active_connections.get(client_id)
        if not bucket:
            return

        if websocket is None:
            # Close all sockets for this client.
            sockets = list(bucket)
            self.active_connections.pop(client_id, None)
            for ws in sockets:
                await _safe_close(ws)
            return

        if websocket not in bucket:
            return
        bucket.discard(websocket)
        if not bucket:
            self.active_connections.pop(client_id, None)
        await _safe_close(websocket)

    async def send_json(self, client_id: UUID, data: dict):
        bucket = self.active_connections.get(client_id)
        if not bucket:
            return

        dead: list[WebSocket] = []
        for websocket in list(bucket):
            if not _is_connected(websocket):
                dead.append(websocket)
                continue
            try:
                await websocket.send_json(data)
            except (RuntimeError, WebSocketDisconnect) as exc:
                logger.debug("send_json skipped client=%s: %s", client_id, exc)
                dead.append(websocket)
            except Exception as exc:
                logger.warning("send_json failed client=%s: %s", client_id, exc)
                dead.append(websocket)

        for ws in dead:
            await self.disconnect(client_id, ws)

    def is_online(self, client_id: UUID) -> bool:
        bucket = self.active_connections.get(client_id)
        if not bucket:
            return False
        return any(_is_connected(ws) for ws in bucket)


class MasterConnectionManager:
    def __init__(self):
        self.managers = {}

    def __getitem__(self, tag: str) -> ConnectionManager:
        if tag not in self.managers:
            self.managers[tag] = ConnectionManager()
        return self.managers[tag]


manager = MasterConnectionManager()
