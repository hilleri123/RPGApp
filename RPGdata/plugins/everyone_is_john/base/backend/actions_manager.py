from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field

from plugins.common.types import ActionContext, ActionInfo, ActionRole
from .workflows import workflows


class ActionsManager:
    def list_actions(self, scene: ActionContext, role: ActionRole) -> list[ActionInfo]:
        return [i for w in workflows for i in w().actions_for(scene, role) ]
