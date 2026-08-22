from typing import List, Literal, Optional
from uuid import UUID

from pydantic import Field

from app.scheme.seen import SeenDataAccess
from ..base_actions import MasterSessionActionBase


class PresentEntity(MasterSessionActionBase):
    msg_type: Literal["present_entity"] = "present_entity"
    scene_id: UUID
    entity_type: Literal["npc", "game_item", "player_character", "location"]
    entity_id: UUID
    data_access: SeenDataAccess = SeenDataAccess.NONE


class GrantEntityDataAccess(MasterSessionActionBase):
    msg_type: Literal["grant_entity_data_access"] = "grant_entity_data_access"
    scene_id: UUID
    entity_type: Literal["npc", "game_item", "player_character"]
    entity_id: UUID


class RevokeEntityDataAccess(MasterSessionActionBase):
    msg_type: Literal["revoke_entity_data_access"] = "revoke_entity_data_access"
    scene_id: UUID
    entity_type: Literal["npc", "game_item", "player_character"]
    entity_id: UUID


class DismissPresentedEntity(MasterSessionActionBase):
    msg_type: Literal["dismiss_presented_entity"] = "dismiss_presented_entity"
