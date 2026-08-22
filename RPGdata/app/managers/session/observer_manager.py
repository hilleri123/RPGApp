from __future__ import annotations

import secrets
from typing import Optional, Tuple
from uuid import UUID

from app import models, scheme
from app.logger import logger

from .user_manager import SessionUserManager


# Без 0/O и 1/I/L — меньше ошибок при вводе [web:433]
CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
CODE_LEN = 6


def _norm_code(code: str) -> str:
    return code.strip().upper().replace("-", "").replace(" ", "")


class SessionObserverManager(SessionUserManager):
    def __init__(self, session_id: UUID | str):
        super().__init__(str(session_id))

    async def _generate_unique_code(self, max_tries: int = 30) -> str:
        """
        Генерим код и проверяем на коллизию внутри текущей сессии.
        6 символов из 32-значного алфавита => 32^6 ≈ 1e9 комбинаций,
        коллизии редки, но проверка дешевая. [web:433]
        """
        for _ in range(max_tries):
            code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LEN))  # [web:433]
            inner = await self.get_inner()
            exists = any(_norm_code(o.code) == code for o in (inner.observers or []))
            if not exists:
                return code
        raise RuntimeError("cannot generate unique observer code (too many collisions)")

    async def add_observer(
        self,
        current_user: models.User,
    ) -> Tuple[bool, list[str], scheme.Observer | None]:
        inner = await self.get_inner()
        observers = list(inner.observers or [])

        code = await self._generate_unique_code()

        obs = scheme.Observer(code=code)
        observers.append(obs)

        await self.set_field("observers", [o.model_dump(mode="json") for o in observers])
        return True, ["observers"]

    async def update_observer(
        self,
        current_user: models.User,
        observer: scheme.Observer,
    ) -> Tuple[bool, list[str]]:
        inner = await self.get_inner()
        observers = list(inner.observers or [])
        code = _norm_code(observer.code)

        changed = False
        for o in observers:
            if _norm_code(o.code) != code:
                continue

            # простая политика: передали None => сброс
            if o.scene_id != observer.scene_id:
                o.scene_id = observer.scene_id
                changed = True
            if o.location_id != observer.location_id:
                o.location_id = observer.location_id
                changed = True
            break
        else:
            return False, []

        if not changed:
            return False, []

        await self.set_field("observers", [o.model_dump(mode="json") for o in observers])
        return True, ["observers"]

    async def delete_observer(self, current_user: models.User, code: str) -> Tuple[bool, list[str]]:
        inner = await self.get_inner()
        observers = list(inner.observers or [])
        code = _norm_code(code)

        new_observers = [o for o in observers if _norm_code(o.code) != code]
        if len(new_observers) == len(observers):
            return False, []

        await self.set_field("observers", [o.model_dump(mode="json") for o in new_observers])
        return True, ["observers"]
