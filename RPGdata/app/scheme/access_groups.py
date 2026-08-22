from pydantic import BaseModel, Field
from typing import List, Optional
from uuid import UUID
from .auth import User
import enum

class RoleAccess(enum.Enum):
    NONE_ROLE = "none"
    READ_ROLE = "read"
    EDIT_PARTIAL_ROLE = "edit_partial"
    EDIT_FULL_ROLE = "edit_full"
    ALL_ROLE = "all"



class MasterGroupBase(BaseModel):
    name: str

    class Config:
        from_attributes = True 

class MasterGroup(MasterGroupBase):
    id: UUID
    users: Optional[list[User]] = Field(default_factory=list)

class MasterGroupCreate(MasterGroupBase):
    pass


class UserWithGroups(User):
    master_groups: List[MasterGroup] = []



class MasterGroupAddUser(BaseModel):
    user_id: UUID
    group_id: UUID
    permission: Optional[str] = None


class MasterGroupScenarioAccessBase(BaseModel):
    master_group_id: UUID
    scenario_id: UUID
    permission: str 

    class Config:
        from_attributes = True


class MasterGroupScenarioAccessCreate(MasterGroupScenarioAccessBase):
    pass


class MasterGroupScenarioAccess(MasterGroupScenarioAccessBase):
    # Со стороны сценария заполняется группа, со стороны группы — название сценария.
    master_group: Optional[MasterGroup] = None
    scenario_name: Optional[str] = None
