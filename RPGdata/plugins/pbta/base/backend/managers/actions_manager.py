from __future__ import annotations
from typing import Any

from plugins.common.types import ActionContext, ActionInfo, ActionRole
from ..codex import PbtaFullCodex
from ..workflows import workflows


class ActionsManager:
    """
    Базовый менеджер действий.
    Принимает список workflow-классов снаружи — конкретная игра
    передаёт свои workflows при инициализации.
    """
    _workflows = workflows

    def __init__(self, codex: PbtaFullCodex) -> None:
        self.codex = codex

    def list_actions(self, scene: ActionContext, role: ActionRole) -> list[ActionInfo]:
        return [
            info
            for w in self._workflows
            for info in w(self.codex).actions_for(scene, role)
        ]