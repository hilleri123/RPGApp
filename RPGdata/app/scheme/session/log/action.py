from __future__ import annotations

from typing import Any, Literal, Optional
from uuid import UUID

from pydantic import Field

from ..base_log import LogMsgBase


class LogActionText(LogMsgBase):
    log_type: Literal["action_text"] = "action_text"
    text: str
    action_id: Optional[UUID] = None
    action_key: Optional[str] = None
    tags: list[str] = Field(default_factory=list)


class LogRoll(LogMsgBase):
    log_type: Literal["roll"] = "roll"
    action_id: Optional[UUID] = None
    action_key: Optional[str] = None
    title: str = ""
    roll_kind: str = "dice.roll"
    dice: list[int] = Field(default_factory=list)
    total: Optional[int] = None
    outcome: Optional[str] = None
    seed: Optional[str] = None
    meta: dict[str, Any] = Field(default_factory=dict)
