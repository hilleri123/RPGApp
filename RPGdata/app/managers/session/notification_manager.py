# app/managers/session/notification_manager.py
from __future__ import annotations

from uuid import UUID
from typing import Iterable, List, Tuple, Any

from app import models, scheme
from app.logger import logger

from .user_manager import SessionUserManager


class SessionNotificationManager(SessionUserManager):
    def __init__(self, session_id: UUID | str):
        super().__init__(str(session_id))

    async def read_notifications(
        self,
        user: models.User,
        notifications_ids: Iterable[UUID] | None = None,
    ) -> Tuple[bool, list[str]]:
        """
        Отмечает уведомления прочитанными:
        - только если user в recipients
        - только выбранные IDs (если переданы), иначе все доступные пользователю
        """
        inner = await self.get_inner()
        notifications = list(inner.notifications or [])

        if notifications_ids is not None:
            ids_set = {str(x) for x in notifications_ids}
        else:
            ids_set = None

        updated = False

        for notif in notifications:
            # фильтр по ids (если задан)
            if ids_set is not None and str(getattr(notif, "id", None)) not in ids_set:
                continue

            recipients = list(getattr(notif, "recipients", None) or [])
            readed_by = list(getattr(notif, "readed_by", None) or [])

            if user.id in recipients and user.id not in readed_by:
                readed_by.append(user.id)
                notif.readed_by = readed_by
                updated = True

        if not updated:
            return False, []

        await self.set_field("notifications", [n.model_dump(mode="json") for n in notifications])
        return True, ["notifications"]

    # Временная совместимость со старым вызовом, если где-то передают list[NotificationUnion]
    async def read_notifications_legacy(
        self,
        user: models.User,
        notifications: list[scheme.NotificationUnion],
    ) -> Tuple[bool, list[str]]:
        ids: list[UUID] = []
        for n in notifications or []:
            nid = getattr(n, "id", None)
            if nid is not None:
                ids.append(nid)
        return await self.read_notifications(user, ids)



    def _build_notifications_for_user(
        self,
        inner: scheme.GameSessionInner,
        current_user_id: UUID
    ) -> List[scheme.NotificationUnion]:
        res = []
        for n in inner.notifications:
            if current_user_id in n.recipients:
                res.append(n)
        return res
