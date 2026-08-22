from typing import Any, Annotated, Optional
from uuid import UUID
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field

from .action import Workflow
from .action_participants import ActionParticipants


def _as_opt_str(v: Any) -> Optional[str]:
    if v is None:
        return None
    return str(v)


OptUrlStr = Annotated[Optional[str], BeforeValidator(_as_opt_str)]


class _EntityExtra(BaseModel):
    model_config = ConfigDict(extra="allow")


class ItemContext(_EntityExtra):
    id: UUID
    name: str
    equipped: bool = False
    tags: Optional[list[str]] = Field(default_factory=list)
    data: dict[str, Any] = Field(default_factory=dict)
    icon_url: OptUrlStr = None
    img_url: OptUrlStr = None


class CharacterContext(_EntityExtra):
    id: UUID
    name: str
    short_desc: Optional[str] = None
    story: Optional[str] = None
    icon_url: OptUrlStr = None
    img_url: OptUrlStr = None
    tags: Optional[list[str]] = Field(default_factory=list)
    data: dict[str, Any] = Field(default_factory=dict)
    items: list[ItemContext] = Field(default_factory=list)


class NPCContext(_EntityExtra):
    id: UUID
    name: str
    description_for_master: Optional[str] = None
    description_for_players: Optional[str] = None
    icon_url: OptUrlStr = None
    img_url: OptUrlStr = None
    tags: Optional[list[str]] = Field(default_factory=list)
    data: dict[str, Any] = Field(default_factory=dict)
    items: list[ItemContext] = Field(default_factory=list)


class ObstacleContext(_EntityExtra):
    id: UUID
    name: str
    tags: Optional[list[str]] = Field(default_factory=list)
    data: dict[str, Any] = Field(default_factory=dict)


class LocationContext(_EntityExtra):
    id: UUID
    name: str
    tags: Optional[list[str]] = Field(default_factory=list)
    data: dict[str, Any] = Field(default_factory=dict)
    map_url: OptUrlStr = None
    map_width: Optional[int] = None
    map_height: Optional[int] = None


class SceneContext(BaseModel):
    id: UUID
    name: str
    location: Optional[LocationContext] = None
    characters: list[CharacterContext] = Field(default_factory=list)
    npcs: list[NPCContext] = Field(default_factory=list)
    items: list[ItemContext] = Field(default_factory=list)
    obstacles: list[ObstacleContext] = Field(default_factory=list)
    data: dict[str, Any]


class Links(BaseModel):
    characterToUserId: dict[UUID, UUID]


class User(BaseModel):
    id: UUID
    full_name: Optional[str] = None
    img_url: OptUrlStr = None


class Player(BaseModel):
    id: UUID
    user: User


class ScenePayload(BaseModel):
    scene: SceneContext
    players: list[Player] = Field(default_factory=list)
    links: Links = Field(default_factory=lambda: Links(characterToUserId={}))


class ActionContext(ScenePayload):
    actionKey: str
    actorUserId: UUID
    can_close: bool = False
    scene: SceneContext
    players: list[Player]
    links: Links
    participants: ActionParticipants
    workflow: Optional[Workflow] = None
    input: Optional[dict[str, Any]] = None
