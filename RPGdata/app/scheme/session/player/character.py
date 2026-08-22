from typing import Optional, List, Literal, Dict, Any, Type, get_type_hints, get_origin
from pydantic import BaseModel, ConfigDict, ValidationError
from datetime import date, datetime
from uuid import UUID

from app.logger import logger
from ..base_actions import PlayerSessionActionBase



class PlayerUpdateStat(PlayerSessionActionBase):
    msg_type: Literal['update_stat'] = 'update_stat'
    character_id: UUID



class PlayerAddStat(PlayerSessionActionBase):
    msg_type: Literal['add_stat'] = 'update_stat'
    character_id: UUID


class PlayerReplaceCharacter(PlayerSessionActionBase):
    msg_type: Literal['player_replace_character'] = 'player_replace_character'
    character_id: UUID
    application_id: Optional[UUID] = None


class PlayerListReplaceCharacters(PlayerSessionActionBase):
    msg_type: Literal['player_list_replace_characters'] = 'player_list_replace_characters'

