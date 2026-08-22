from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

from app.scheme.session.log import LogActionText, LogMsgBase, LogRoll
from app.logger import logger


def broadcast_to_log(
    user_id: UUID,
    broadcast: dict[str, Any],
    *,
    action_id: Optional[UUID] = None,
    action_key: Optional[str] = None,
) -> Optional[LogRoll]:
    if not isinstance(broadcast, dict):
        return None

    kind = str(broadcast.get("type") or "")
    if kind != "dice.roll":
        return None

    dice = broadcast.get("rolls") or broadcast.get("dice") or []
    if not isinstance(dice, list):
        dice = []

    title_parts: list[str] = []
    if broadcast.get("character_name"):
        title_parts.append(str(broadcast["character_name"]))
    if broadcast.get("action"):
        title_parts.append(str(broadcast["action"]))
    title = " · ".join(title_parts) if title_parts else "Бросок"

    total = broadcast.get("total")
    if total is None and dice:
        try:
            total = int(broadcast.get("best", max(int(x) for x in dice)))
        except (TypeError, ValueError):
            total = None

    return LogRoll(
        user_id=user_id,
        action_id=action_id,
        action_key=action_key,
        title=title,
        roll_kind=kind,
        dice=[int(x) for x in dice],
        total=total,
        outcome=str(broadcast.get("outcome")) if broadcast.get("outcome") is not None else None,
        seed=str(broadcast.get("roll_seed")) if broadcast.get("roll_seed") else None,
        meta={k: v for k, v in broadcast.items() if k not in {"type", "rolls", "dice"}},
    )


def log_event_draft_to_model(user_id: UUID, draft: dict[str, Any]) -> Optional[LogMsgBase]:
    if not isinstance(draft, dict):
        return None

    log_type = draft.get("log_type")
    payload = {k: v for k, v in draft.items() if k != "log_type"}
    payload["user_id"] = user_id

    if log_type == "action_text":
        return LogActionText.model_validate(payload)
    if log_type == "roll":
        return LogRoll.model_validate(payload)

    logger.warning("unknown log_event draft type=%s", log_type)
    return None


def extract_workflow_log_lines(workflow: Optional[dict[str, Any]]) -> list[str]:
    if not isinstance(workflow, dict):
        return []
    context = workflow.get("context") or {}
    entry = context.get("entry") or {}
    lines = entry.get("log_lines") or []
    if not isinstance(lines, list):
        return []
    return [str(x) for x in lines if str(x).strip()]
