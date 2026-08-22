from __future__ import annotations
from typing import Any
from pydantic import ValidationError

from .types import NpcData
from .codex import FullCodex
from ...base.backend.npcs_manager import NpcsManager as BaseNpcsManager

class NpcsManager(BaseNpcsManager):
    def __init__(self, codex: FullCodex) -> None:
        self.skills = codex.skills