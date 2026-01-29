from __future__ import annotations

from typing import Any, Callable

class WorkflowRouter:
    def __init__(self) -> None:
        self._start: dict[str, Callable[..., Any]] = {}
        self._present: dict[str, Callable[..., Any]] = {}
        self._submit: dict[str, Callable[..., Any]] = {}

    def register(self, action_key: str, *, start, present, submit) -> None:
        self._start[action_key] = start
        self._present[action_key] = present
        self._submit[action_key] = submit

    def start(self, action_key: str, **kw) -> Any:
        fn = self._start.get(action_key)
        if not fn:
            return {"ok": False, "issues": [{"path": "actionKey", "message": "Unknown actionKey", "level": "error"}]}
        return fn(**kw)

    def present(self, action_key: str, **kw) -> Any:
        fn = self._present.get(action_key)
        if not fn:
            return {"ok": False, "issues": [{"path": "actionKey", "message": "Unknown actionKey", "level": "error"}]}
        return fn(**kw)

    def submit(self, action_key: str, **kw) -> Any:
        fn = self._submit.get(action_key)
        if not fn:
            return {"ok": False, "issues": [{"path": "actionKey", "message": "Unknown actionKey", "level": "error"}]}
        return fn(**kw)
