from __future__ import annotations

from typing import Any, Optional
from pydantic import BaseModel, Field


class RpcResult(BaseModel):
    msg_type: str = Field(default="rpc_result")
    request_id: str
    ok: bool
    data: Optional[Any] = None
    error: Optional[str] = None


class ValidateNpcRequest(BaseModel):
    # то, что шлет фронт через sendRequest
    user_role: str
    msg_type: str  # "validate_npc"
    request_id: str
    scene_id: str
    npc: dict


class NpcContextsRequest(BaseModel):
    user_role: str
    msg_type: str  # "npc_contexts"
    request_id: str
    scene_id: str
