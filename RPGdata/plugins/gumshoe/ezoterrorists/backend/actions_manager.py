from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field

from plugins.common.types import ActionContext, ActionInfo, ActionRole
from .workflows import workflows


class ActionsManager:
    def __init__(self, full_codex):
        self.codex = full_codex

    def list_actions(self, scene: ActionContext, role: ActionRole) -> list[ActionInfo]:
        return [i for w in workflows for i in w(self.codex).actions_for(scene, role) ]
