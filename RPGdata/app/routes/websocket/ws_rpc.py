from __future__ import annotations

from uuid import UUID
from typing import Any, Dict, Optional, Callable, Awaitable, Literal

from sqlalchemy.ext.asyncio import AsyncSession
from app import scheme
from app.managers.session import CurrentSessionManager
from app.routes._helpers import validate_entity_data
from app.routes.rules.config_editor import editor_config_for_scenario

from app.plugins.contracts import EntityPayload


AllowedEntity = Literal["npc", "item", "obstacle"]
AllowedMsg = Literal["editor_config", "validate_entity", "list_replace_characters"]


class SessionWsRpcHandler:
    def __init__(
        self,
        *,
        session_m: CurrentSessionManager,
        db: AsyncSession,
        current_user: Any,
        is_master: bool,
        send_json_to_current: Callable[[dict], Awaitable[None]],
    ):
        self.session_m = session_m
        self.db = db
        self.current_user = current_user
        self.is_master = is_master
        self.send_json_to_current = send_json_to_current

    async def _send_ok(self, request_id: str, data: dict):
        msg = scheme.RpcResult(request_id=request_id, ok=True, data=data)
        await self.send_json_to_current(msg.model_dump(mode="json"))

    async def _send_err(self, request_id: str, error: str):
        msg = scheme.RpcResult(request_id=request_id, ok=False, error=error)
        await self.send_json_to_current(msg.model_dump(mode="json"))

    async def _get_scenario_id(self) -> UUID:
        inner = await self.session_m.get_inner()
        if not inner.scenario_id:
            raise ValueError("scenario_id not found in session")
        return UUID(str(inner.scenario_id))

    def _normalize_entity(self, raw: Any) -> str:
        ent = str(raw or "").strip().lower()
        if ent in {"location", "character", "npc", "item", "obstacle", "scene"}:
            return ent
        raise ValueError(f"Unsupported entity={raw}")

    async def try_handle(self, raw_data: dict) -> bool:
        request_id = raw_data.get("request_id")
        if not request_id:
            return False

        msg_type = raw_data.get("msg_type")
        if msg_type not in {"editor_config", "validate_entity", "list_replace_characters"}:
            await self._send_err(request_id, f"Unknown rpc msg_type={msg_type}")
            return True

        try:
            if msg_type == "list_replace_characters":
                if self.is_master:
                    await self._send_err(request_id, "Only players can list replace characters")
                    return True
                options = await self.session_m.list_replace_character_options(self.current_user)
                await self._send_ok(request_id, {"options": options})
                return True

            entity = self._normalize_entity(raw_data.get("entity"))
            scenario_id = await self._get_scenario_id()

            if msg_type == "editor_config":
                context = raw_data.get("context") or {}
                # если хочешь — подмешивай scene_id сюда же
                scene_id = raw_data.get("scene_id")
                if scene_id:
                    context = {**context, "scene_id": str(scene_id)}

                config = await editor_config_for_scenario(
                    scenario_id=scenario_id,
                    entity=entity,
                    context=context,
                    db=self.db,
                )
                await self._send_ok(request_id, {"config": config})
                return True

            if msg_type == "validate_entity":
                payload = EntityPayload(
                    data = raw_data.get("data") or {},
                    tags = raw_data.get("tags") or []
                )
                context = raw_data.get("context") or {}
                # validate_entity_data сейчас не принимает context — ок, оставим на будущее
                res = await validate_entity_data(
                    db=self.db,
                    scenario_id=scenario_id,
                    entity=entity,
                    payload=payload,
                )
                await self._send_ok(request_id, {"ok": bool(res.ok), "issues": res.issues or [], "data": res.result.data})
                return True

            await self._send_err(request_id, "rpc not implemented")
            return True

        except Exception as e:
            await self._send_err(request_id, str(e))
            return True
