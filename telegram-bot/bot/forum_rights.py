"""How to tell that Telegram refused a forum topic for lack of admin rights."""

from __future__ import annotations


_ADMIN_MARKERS = (
    "not enough rights",
    "chat_admin_required",
    "need administrator",
    "manage topics",
    "not a member",
    "have no rights",
    "not an admin",
    "not administrator",
)


def lacks_forum_admin_rights(exc: BaseException) -> bool:
    text = str(exc).lower()
    return any(marker in text for marker in _ADMIN_MARKERS)
