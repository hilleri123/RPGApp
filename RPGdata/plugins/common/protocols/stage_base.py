from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Callable, Optional, Protocol, Type, TypeVar, Union
from uuid import UUID

from pydantic import ValidationError

from ..types import SceneContext, ActionParticipants, Workflow, SubmitResult, StageEnvelope, Links

# --------- helpers ---------

def issue(path: str, message: str, level: str = "error") -> dict[str, Any]:
    return {"path": path, "message": message, "level": level}


def dump(m: Any) -> Any:
    return m.model_dump(mode="json") if hasattr(m, "model_dump") else m.dict()


# --------- typing ---------

VisibleIdsFn = Callable[[ActionParticipants, Workflow], list[str]]
FallbackIdsFn = Callable[[dict[str, Any]], list[str]]

TModel = TypeVar("TModel")


@dataclass
class StageCtx:
    scene: SceneContext
    actor_user_id: UUID
    participants: ActionParticipants
    participants_dict: ActionParticipants  # <-- см. ниже
    rb: "ResultBuilder"
    links: Links


class BaseStage(ABC):
    """
    Protocol вместо ABC: проще, и даёт строгую проверку сигнатур.
    """
    def __init__(self, full_codex):
        self.full_codex = full_codex

    key: str

    @abstractmethod
    def submit(self, wf: Workflow, ctx: StageCtx, input_dict: dict[str, Any]) -> SubmitResult: ...


class ResultBuilder:
    def __init__(self, visible_ids_fn: VisibleIdsFn, fallback_ids_fn: FallbackIdsFn):
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
        logEvents: Optional[list[dict[str, Any]]] = None,
        sessionPatch: Optional[dict[str, Any]] = None,
        next: Optional[dict[str, Any]] = None,
        can_close: bool = False,
    ) -> SubmitResult:
        if wf is not None and participants is not None:
            participant_ids = self._visible_ids_fn(participants, wf)
        else:
            participant_ids = self._fallback_ids_fn(participants_dict_fallback or {})

        # SubmitResult.workflow is required — never leave it None on failed starts.
        if wf is None:
            wf = Workflow(
                actionKey="",
                stageKey="",
                status="canceled",
                context={},
                stageData={},
                tags=[],
            )

        return SubmitResult(
            ok=ok,
            issues=issues or [],
            workflow=dump(wf),
            next=next,
            broadcasts=broadcasts or [],
            logEvents=logEvents or [],
            participantIds=participant_ids,
            sessionPatch=sessionPatch,
            can_close=can_close
        )

    def log_text(
        self,
        text: str,
        *,
        action_key: Optional[str] = None,
        tags: Optional[list[str]] = None,
    ) -> dict[str, Any]:
        draft: dict[str, Any] = {"log_type": "action_text", "text": text}
        if action_key:
            draft["action_key"] = action_key
        if tags:
            draft["tags"] = tags
        return draft

    def log_roll(
        self,
        *,
        title: str,
        dice: list[int],
        total: Optional[int] = None,
        outcome: Optional[str] = None,
        seed: Optional[str] = None,
        roll_kind: str = "dice.roll",
        meta: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        draft: dict[str, Any] = {
            "log_type": "roll",
            "title": title,
            "dice": dice,
            "roll_kind": roll_kind,
        }
        if total is not None:
            draft["total"] = total
        if outcome is not None:
            draft["outcome"] = outcome
        if seed is not None:
            draft["seed"] = seed
        if meta:
            draft["meta"] = meta
        return draft

    def parse_input(
        self,
        model_cls: Type[TModel],
        input_dict: dict[str, Any],
        wf: Workflow,
        ctx: StageCtx,
    ) -> Union[TModel, SubmitResult]:
        """
        Возвращает либо валидную модель, либо SubmitResult(ok=False, issues=[...]).
        """
        try:
            return model_cls.model_validate(input_dict) if hasattr(model_cls, "model_validate") else model_cls.parse_obj(input_dict)  # type: ignore[attr-defined]
        except ValidationError as e:
            return self.result(
                ok=False,
                wf=wf,
                participants=ctx.participants,
                participants_dict_fallback=ctx.participants_dict,
                issues=[issue("input", str(e))],
            )
