from typing import Any, Literal, Optional
from uuid import UUID
from pydantic import BaseModel, Field

ActionRole = Literal["gm", "initiator", "player", "assistant", "observer"]

# class ActionParticipant(BaseModel):
#     userId: UUID
#     roles: set[ActionRole] = Field(default_factory=set)
#     meta: dict[str, Any] = Field(default_factory=dict)

class ActionParticipants(BaseModel):
    gmUserId: Optional[UUID] = None
    initiatorUserId: Optional[UUID] = None
    # participants: list[ActionParticipant] = Field(default_factory=list)
    participants: list[UUID]
    placeholders: dict[str, UUID] = Field(default_factory=dict)

    def roles_for(self, user_id: str) -> set[ActionRole]:
        roles: set[ActionRole] = set()

        if self.gmUserId and user_id == self.gmUserId:
            roles.add("gm")
        if self.initiatorUserId and user_id == self.initiatorUserId:
            roles.add("initiator")

        if not roles:
            roles.add("player")
        return roles

    def has(self, user_id: str, role: ActionRole) -> bool:
        return role in self.roles_for(user_id)
