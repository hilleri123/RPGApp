"""Workflow stage — owns only its data bucket (stageData.stages[key])."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from .stage_base import StageCtx, issue
from plugins.common.types import ActionParticipants, Workflow


@dataclass
class StageOutcome:
    """Internal validation result (used inside submit/patch implementations)."""

    ok: bool
    data: dict[str, Any] = field(default_factory=dict)
    issues: list[dict[str, Any]] = field(default_factory=list)
    reset_following: bool = False

    @classmethod
    def ok_data(cls, data: dict[str, Any] | None = None, *, reset_following: bool = False) -> StageOutcome:
        return cls(ok=True, data=dict(data or {}), reset_following=reset_following)

    @classmethod
    def fail(cls, path: str, message: str) -> StageOutcome:
        return cls(ok=False, issues=[issue(path, message)])


class Stage(ABC):
    key: str

    def clear(self, wf: Workflow) -> None:
        """Drop this stage's stored data."""

    def get(self, wf: Workflow) -> dict[str, Any]:
        return {}

    def put(self, wf: Workflow, data: dict[str, Any]) -> None:
        """Replace stage data."""

    def patch(self, wf: Workflow, ctx: StageCtx, delta: dict[str, Any]) -> list[dict[str, Any]]:
        """Merge delta into stage data. Returns validation issues (empty = ok)."""
        cur = dict(self.get(wf))
        cur.update(delta)
        self.put(wf, cur)
        return []

    @abstractmethod
    def visibility(self, wf: Workflow, ctx: StageCtx, participants: ActionParticipants) -> list[str]: ...
