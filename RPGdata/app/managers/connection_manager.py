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


    def is_empty(self) -> bool:
        return not self.active_connections


class MasterConnectionManager:
    def __init__(self):
        self.managers = {}

    def __getitem__(self, tag: str) -> ConnectionManager:
        if tag not in self.managers:
            self.managers[tag] = ConnectionManager()
        return self.managers[tag]

    def release(self, tag: str) -> None:
        """Забыть комнату, в которой не осталось сокетов."""
        bucket = self.managers.get(tag)
        if bucket is not None and bucket.is_empty():
            self.managers.pop(tag, None)


manager = MasterConnectionManager()


# Сокеты держим по комнате, а не по пользователю целиком: у одного человека
# могут быть открыты два лобби или две сессии, и рассылка одной не должна
# долетать во вкладку другой (lobby_closed выкидывал из чужого лобби,
# session_started уводил не туда, обновления одной сессии портили другую).
def _room_key(raw) -> str:
    text = str(raw).strip()
    try:
        return str(UUID(text))
    except (TypeError, ValueError):
        return text.lower()


def lobby_tag(lobby_id) -> str:
    return f"lobby:{_room_key(lobby_id)}"


def session_tag(session_id) -> str:
    return f"session:{_room_key(session_id)}"


def lobby_sockets(lobby_id) -> ConnectionManager:
    return manager[lobby_tag(lobby_id)]


def session_sockets(session_id) -> ConnectionManager:
    return manager[session_tag(session_id)]
