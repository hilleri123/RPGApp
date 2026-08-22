from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any, Dict, Set
from fastapi import WebSocket
from starlette.websockets import WebSocketState

@dataclass(frozen=True)
class ChannelKey:
    code: str  # например "1234" или UUID сцены строкой

class ChannelManager:
    def __init__(self) -> None:
        self._channels: Dict[ChannelKey, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, key: ChannelKey, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._channels.setdefault(key, set()).add(ws)

    async def disconnect(self, key: ChannelKey, ws: WebSocket) -> None:
        async with self._lock:
            conns = self._channels.get(key)
            if not conns:
                return
            conns.discard(ws)
            if not conns:
                self._channels.pop(key, None)

    async def broadcast_json(self, key: ChannelKey, data: dict[str, Any]) -> None:
        async with self._lock:
            conns = list(self._channels.get(key, set()))

        if not conns:
            return

        dead: list[WebSocket] = []
        for ws in conns:
            try:
                if ws.client_state != WebSocketState.CONNECTED:
                    dead.append(ws)
                    continue
                await ws.send_json(data)
            except Exception:
                dead.append(ws)

        if dead:
            async with self._lock:
                cur = self._channels.get(key)
                if cur:
                    for ws in dead:
                        cur.discard(ws)
                    if not cur:
                        self._channels.pop(key, None)

manager = ChannelManager()
