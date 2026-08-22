from typing import Optional, List, Literal, Dict, Any, Type, get_type_hints, get_origin
from pydantic import BaseModel, ConfigDict, ValidationError
from datetime import date, datetime
from uuid import UUID

from app.logger import logger
from ..base_actions import MasterSessionActionBase


class RunSceneAction(MasterSessionActionBase):
    msg_type: Literal["run_scene_action"] = "run_scene_action"
    scene_id: UUID
    action_key: str



class SubmitActionStep(MasterSessionActionBase):
    msg_type: Literal["submit_action_step"] = "submit_action_step"
    action_id: UUID
    input: Dict[str, Any] = {}


class PatchActionStep(MasterSessionActionBase):
    msg_type: Literal["patch_action_step"] = "patch_action_step"
    action_id: UUID
    input: Dict[str, Any] = {}


class CancelSceneAction(MasterSessionActionBase):
    msg_type: Literal["cancel_action_step"] = "cancel_action_step"
    action_id: UUID
    