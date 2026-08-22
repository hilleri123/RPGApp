from __future__ import annotations

from typing import Any, Protocol
from ..types import ActionContext, SceneContext, StageEnvelope, SubmitResult, ActionRole, ActionInfo



class BaseStage:
    key = "unkown"
    
    def __init__(self, full_codex):
        self.full_codex = full_codex


class WorkflowLike(Protocol):
    key: str

    def actions_for(self, scene: SceneContext, role: ActionRole) -> list[ActionInfo]: ...

    def start(self, action_context: ActionContext) -> SubmitResult: ...
    def present(
        self,
        action_context: ActionContext,
    ) -> StageEnvelope: ...
    def submit(
        self,
        action_context: ActionContext,
    ) -> SubmitResult: ...




def _unknown(action_key: str):
    return {"ok": False, "issues": [{"path": "actionKey", "message": f"Unknown actionKey '{action_key}'", "level": "error"}]}


class WorkflowRouter:
    def __init__(self, full_codex) -> None:
        self.full_codex = full_codex
        self._wf: dict[str, WorkflowLike] = {}

    def register(self, WF) -> None:
        wf: WorkflowLike = WF(self.full_codex)
        self._wf[str(wf.key)] = wf

    def start(self, action_key: str, action_context: ActionContext) -> SubmitResult | dict[str, Any]:
        wf = self._wf.get(action_key)
        if not wf:
            return _unknown(action_key)
        return wf.start(action_context)

    def submit(
        self,
        action_key: str,
        action_context: ActionContext,
    ) -> SubmitResult | dict[str, Any]:
        wf = self._wf.get(action_key)
        if not wf:
            return _unknown(action_key)
        return wf.submit(action_context=action_context)

    def patch(
        self,
        action_key: str,
        action_context: ActionContext,
    ) -> SubmitResult | dict[str, Any]:
        wf = self._wf.get(action_key)
        if not wf:
            return _unknown(action_key)
        patch_fn = getattr(wf, "patch", None)
        if not callable(patch_fn):
            return {"ok": False, "issues": [{"path": "", "message": "Patch not supported", "level": "error"}]}
        return patch_fn(action_context=action_context)
