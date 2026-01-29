from typing import Any, Literal, Optional
from pydantic import BaseModel, Field

ActionRole = Literal["gm", "initiator", "player", "assistant", "observer"]

class ActionParticipant(BaseModel):
    userId: str
    roles: set[ActionRole] = Field(default_factory=set)
    meta: dict[str, Any] = Field(default_factory=dict)

class ActionParticipants(BaseModel):
    gmUserId: Optional[str] = None
    initiatorUserId: Optional[str] = None
    participants: list[ActionParticipant] = Field(default_factory=list)
    placeholders: dict[str, Any] = Field(default_factory=dict)

    def roles_for(self, user_id: str) -> set[ActionRole]:
        roles: set[ActionRole] = set()

        if self.gmUserId and user_id == self.gmUserId:
            roles.add("gm")
        if self.initiatorUserId and user_id == self.initiatorUserId:
            roles.add("initiator")

        for p in self.participants:
            if p.userId == user_id:
                roles |= set(p.roles)

        if not roles:
            roles.add("player")
        return roles

    def has(self, user_id: str, role: ActionRole) -> bool:
        return role in self.roles_for(user_id)
