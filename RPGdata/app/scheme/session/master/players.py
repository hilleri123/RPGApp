from typing import Literal
from uuid import UUID

from ..base_actions import MasterSessionActionBase


class MasterKickPlayer(MasterSessionActionBase):
    msg_type: Literal['kick_player'] = 'kick_player'
    player_id: UUID


class MasterDeselectPlayerCharacter(MasterSessionActionBase):
    msg_type: Literal['master_deselect_character'] = 'master_deselect_character'
    player_id: UUID


class MasterAssignPlayerCharacter(MasterSessionActionBase):
    msg_type: Literal['master_assign_character'] = 'master_assign_character'
    player_id: UUID
    character_id: UUID


class MasterSetPlayerColor(MasterSessionActionBase):
    msg_type: Literal['master_set_player_color'] = 'master_set_player_color'
    player_id: UUID
    color: str
