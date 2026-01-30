from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

from pydantic import ValidationError

from ..action_participants import ActionParticipants
from .types import Workflow, SubmitResult


def _issue(path: str, message: str, level: str = "error") -> dict[str, Any]:
    return {"path": path, "message": message, "level": level}


def _dump(m: Any) -> Any:
    return m.model_dump(mode="json") if hasattr(m, "model_dump") else m.dict()


@dataclass
class StageCtx:
    scene: dict[str, Any]
    actor_user_id: str
    participants: ActionParticipants
    participants_dict: dict[str, Any]
    rb: ResultBuilder


class BaseStage:
    key: str

    def present(self, wf: Workflow, ctx: StageCtx) -> Any:
        raise NotImplementedError

    def submit(self, wf: Workflow, ctx: StageCtx, input_dict: dict[str, Any]) -> SubmitResult:
        raise NotImplementedError


class ResultBuilder:
    def __init__(self, visible_ids_fn, fallback_ids_fn):
        self._visible_ids_fn = visible_ids_fn
        self._fallback_ids_fn = fallback_ids_fn

    def result(
        self,
        *,
        ok: bool,
        wf: Optional[Workflow],
        participants: Optional[ActionParticipants],
        participants_dict_fallback: dict[str, Any],
        issues: Optional[list[dict[str, Any]]] = None,
        broadcasts: Optional[list[dict[str, Any]]] = None,
        sessionPatch: Optional[dict[str, Any]] = None,
        next: Optional[dict[str, Any]] = None,
    ) -> SubmitResult:
        if wf is not None and participants is not None:
            participant_ids = self._visible_ids_fn(participants, wf)
        else:
            participant_ids = self._fallback_ids_fn(participants_dict_fallback or {})

        return SubmitResult(
            ok=ok,
            issues=issues or [],
            workflow=_dump(wf) if wf is not None else None,
            next=next,
            broadcasts=broadcasts or [],
            participantIds=participant_ids,
            sessionPatch=sessionPatch,
        )

    @staticmethod
    def parse_input(model_cls, input_dict: dict[str, Any], rb, wf, ctx) -> Any | SubmitResult:
        try:
            return model_cls.model_validate(input_dict) if hasattr(model_cls, "model_validate") else model_cls.parse_obj(input_dict)
        except ValidationError as e:
            return rb.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[_issue("input", str(e))],
            )
