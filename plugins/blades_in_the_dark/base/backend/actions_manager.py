from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field

Role = Literal["gm", "initiator", "player"]

class ActionInfo(BaseModel):
    key: str
    title: str
    roles: list[Role] = Field(default_factory=list)
    description: str = ""

class ActionsManager:
    def list_actions(self, scene: dict[str, Any], role: Role) -> list[ActionInfo]:
        actions = [
            ActionInfo(
                key="blades.roll_action",
                title="Action roll",
                roles=["gm", "initiator", "player"],
                description="Выбрать action → GM задаёт position/effect → подтверждение → бросок → (опционально) resistance.",
            )
        ]
        return [a for a in actions if role in a.roles]
