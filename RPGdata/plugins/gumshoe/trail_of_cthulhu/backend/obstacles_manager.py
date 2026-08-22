# obstacles_manager.py
from __future__ import annotations

from typing import Any

from pydantic import ValidationError

from plugins.common.types import ValidateResult, ValidationIssue
from .codex import FullCodex

from ...base.backend.obstacles_manager import ObstaclesManager as BaseObstaclesManager


class ObstaclesManager(BaseObstaclesManager):
    def __init__(self, codex: FullCodex) -> None:
        self.skills = codex.skills
