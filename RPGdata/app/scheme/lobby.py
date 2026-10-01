from typing import Optional, List, Literal, Dict, Any, Type, get_type_hints, get_origin
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from uuid import UUID
from datetime import date, datetime, timezone
from .auth import User
from .character import PlayerCharacter
from .player import Player, PlayerCreate
from .scenario import Scenario 
from app.logger import logger


class LobbyBase(BaseModel):
    name: str
    created_at: Optional[datetime] = datetime.now(timezone.utc)
    max_players: int
    players: Optional[List[Player]] = Field(default_factory=list)
    users: Optional[List[User]] = Field(default_factory=list)
    scenario: Optional[Scenario] = None
    launched_scenario_id: Optional[UUID] = None
    party_id: Optional[UUID] = None
    campaign_id: Optional[UUID] = None
    characters: Optional[List[PlayerCharacter]] = Field(default_factory=list)
    imported_characters: Optional[List[PlayerCharacter]] = Field(default_factory=list)
    # Кого мастер выгнал. Без этого списка кик бессмыслен: лобби добавляет
    # любого подключившегося обратно на следующем же реконнекте.
    banned_user_ids: Optional[List[UUID]] = Field(default_factory=list)
    # Лобби создаётся закрытым: войти может мастер, приглашённые и те, кто уже внутри.
    # Мастер либо открывает его всем (is_open), либо приглашает игроков поимённо.
    is_open: bool = False
    invited_users: Optional[List[User]] = Field(default_factory=list)
    # Не хранится в Redis: присутствие считается в момент рассылки по живым сокетам
    # (id мастера, приглашённых, ожидающих и игроков, у которых сейчас есть соединение).
    online_user_ids: Optional[List[UUID]] = Field(default_factory=list)

    model_config = ConfigDict(
        ser_json_encoders={
            datetime: lambda v: v.isoformat()
        },
        from_attributes=True
    )

class LobbyCreate(LobbyBase):
    master_id: Optional[UUID] = None

class Lobby(LobbyBase):
    id: UUID
    master: User

    class Config:
        from_attributes = True 

class LobbyPreview(BaseModel):
    """Строка каталога лобби.

    Полный Lobby здесь отдавать нельзя: в нём лежит выбранный сценарий целиком
    вместе с персонажами, а каталог видит любой аутентифицированный пользователь.
    """
    id: UUID
    name: str
    created_at: Optional[datetime] = None
    max_players: int
    scenario_name: Optional[str] = None
    master_id: Optional[UUID] = None
    master_name: str = ""
    player_count: int = 0
    member_ids: List[UUID] = Field(default_factory=list)
    is_open: bool = False
    is_invited: bool = False

    @classmethod
    def from_lobby(cls, lobby: "Lobby", viewer_id: Optional[UUID] = None) -> "LobbyPreview":
        players = lobby.players or []
        users = lobby.users or []
        member_ids = [p.user.id for p in players if p.user] + [u.id for u in users]
        return cls(
            id=lobby.id,
            name=lobby.name,
            created_at=lobby.created_at,
            max_players=lobby.max_players,
            scenario_name=lobby.scenario.name if lobby.scenario else None,
            master_id=lobby.master.id if lobby.master else None,
            master_name=(lobby.master.full_name or "") if lobby.master else "",
            player_count=len(players),
            member_ids=member_ids,
            is_open=bool(lobby.is_open),
            is_invited=viewer_id is not None
            and any(u.id == viewer_id for u in (lobby.invited_users or [])),
        )


class LobbyUserHit(BaseModel):
    """Результат поиска игрока для приглашения: без email и прочих чувствительных полей."""
    id: UUID
    full_name: Optional[str] = None
    tg: Optional[str] = None
    icon_url: Optional[str] = None
    has_telegram: bool = False


class SessionRedirect(BaseModel):
    msg_type: Literal["session_started"] = "session_started"
    session_id: UUID


class LobbyClosed(BaseModel):
    msg_type: Literal["lobby_closed"] = "lobby_closed"


class LobbyError(BaseModel):
    msg_type: Literal["lobby_error"] = "lobby_error"
    code: str = "unknown"
    message: str



def get_all_subclasses(cls) -> List[Type]:
    """Рекурсивно собирает все подклассы"""
    subclasses = []
    for subclass in cls.__subclasses__():
        subclasses.append(subclass)
        subclasses.extend(get_all_subclasses(subclass))
    return subclasses


class ActionBase(BaseModel):
    user_id: Optional[UUID] = None
    user_role: str
    msg_type: str
    created_at: Optional[datetime] = datetime.now(timezone.utc)

    @staticmethod
    def parse_action(data: Dict[str, Any]):
        # Получаем ВСЕ классы-наследники CommitAction
        action_classes = get_all_subclasses(ActionBase)
        # logger.debug(f"{action_classes=}")
        
        for cls in action_classes:
            # Проверяем наличие обязательных атрибутов
            type_hints = get_type_hints(cls)
            cls_user_role = type_hints.get('user_role', None)
            if cls_user_role and get_origin(cls_user_role) is Literal:
                cls_user_role = cls_user_role.__args__[0]
            cls_msg_type = type_hints.get('msg_type', None)
            if cls_msg_type and get_origin(cls_msg_type) is Literal:
                cls_msg_type = cls_msg_type.__args__[0]
            # if cls_msg_type:
                # cls_msg_type = cls_user_role.__args__[0] if hasattr(cls_msg_type, '__args__') else None
                
            # logger.debug(f"{cls=} {cls_user_role=} {cls_msg_type=}")
            # Проверяем соответствие user_role и msg_type
            if (cls_user_role == data.get('user_role') and
                cls_msg_type == data.get('msg_type')):
                try:
                    return cls(**data)
                except ValidationError as e:
                    raise ValueError(f"Validation error for {cls.__name__}: {e}")
        
        raise ValueError("No matching action class found")


class MasterActionBase(ActionBase):
    user_role: Literal['master'] = 'master'

class MasterSelectScenarioAction(MasterActionBase):
    msg_type: Literal['select_scenario'] = 'select_scenario'
    scenario_id: UUID

class MasterSelectLaunchedScenarioAction(MasterActionBase):
    msg_type: Literal['select_launched_scenario'] = 'select_launched_scenario'
    launched_scenario_id: UUID

class MasterSelectPartyAction(MasterActionBase):
    msg_type: Literal['select_party'] = 'select_party'
    party_id: UUID

class MasterSelectCampaignAction(MasterActionBase):
    msg_type: Literal['select_campaign'] = 'select_campaign'
    campaign_id: UUID

class MasterKickPlayer(MasterActionBase):
    msg_type: Literal['kick_player'] = 'kick_player'
    player_id: UUID

class MasterDeselectPlayerCharacter(MasterActionBase):
    msg_type: Literal['master_deselect_character'] = 'master_deselect_character'
    player_id: UUID
    user_id: Optional[UUID] = None

class MasterSetLobbyOpen(MasterActionBase):
    msg_type: Literal['set_lobby_open'] = 'set_lobby_open'
    is_open: bool

class MasterInviteUser(MasterActionBase):
    msg_type: Literal['invite_user'] = 'invite_user'
    invite_user_id: UUID

class MasterUninviteUser(MasterActionBase):
    msg_type: Literal['uninvite_user'] = 'uninvite_user'
    invite_user_id: UUID

class MasterStartSession(MasterActionBase):
    msg_type: Literal['start_session'] = 'start_session'


class MasterCloseLobby(MasterActionBase):
    msg_type: Literal['close_lobby'] = 'close_lobby'


class UserActionBase(ActionBase):
    user_role: Literal['user'] = 'user'

class UserBecomePlayerAction(UserActionBase):
    msg_type: Literal['user_become_player'] = 'user_become_player'
    player: PlayerCreate

class UserLeave(UserActionBase):
    msg_type: Literal['user_leave'] = 'user_leave'


class PlayerActionBase(ActionBase):
    user_role: Literal['player'] = 'player'

class PlayerSelectCharacterAction(PlayerActionBase):
    msg_type: Literal['select_character'] = 'select_character'
    character_id: UUID

class PlayerSelectApplicationCharacterAction(PlayerActionBase):
    msg_type: Literal['select_application_character'] = 'select_application_character'
    application_id: UUID

class PlayerDeselectCharacterAction(PlayerActionBase):
    msg_type: Literal['deselect_character'] = 'deselect_character'

class PlayerReady(PlayerActionBase):
    msg_type: Literal['player_ready'] = 'player_ready'
    is_ready: bool

class SelectColor(PlayerActionBase):
    msg_type: Literal['select_color'] = 'select_color'
    color: str
