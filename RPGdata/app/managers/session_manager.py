"""Session manager — create approaches via launched scenario model."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Literal, Optional

from app.managers.session.observer_manager import _norm_code

from app.infrastructure.redis_service import redis_client
from app import models, scheme
from app.infrastructure.database import get_async_session as get_db
from app.logger import logger
from app.managers.session import CurrentSessionManager, SESSION_KEY_PREFIX
from app.services.launched_scenario_service import (
    ConcurrentApproachError,
    launch_and_start_approach,
    start_approach,
)


class SessionManager:
    def __init__(self):
        self.managers: dict[str, CurrentSessionManager] = {}

    async def ensure_manager(self, session_id: str) -> CurrentSessionManager:
        if session_id not in self.managers:
            launched_id: str | None = None
            async for db in get_db():
                gs = await db.get(models.GameSession, UUID(session_id))
                if gs and gs.launched_scenario_id:
                    launched_id = str(gs.launched_scenario_id)
            self.managers[session_id] = CurrentSessionManager(
                UUID(session_id), launched_scenario_id=launched_id
            )
        return self.managers[session_id]

    def __getitem__(self, session_id: str) -> CurrentSessionManager:
        """Намеренно недоступно: менеджер нельзя собрать без launched_scenario_id.

        Ключ Redis зависит от него (`launched:{id}` против `session:{id}`), так
        что менеджер без него читает другой документ: session_exists() отдаёт
        False для живой сессии. Хуже — результат зависел от того, какой путь
        первым положил менеджер в кеш, и одна и та же сессия вела себя
        по-разному от запроса к запросу.
        """
        raise TypeError(
            "session_manager[...] недоступен: используйте "
            "await session_manager.ensure_manager(session_id)"
        )

    async def list_sessions(self, user: models.User = None) -> List[scheme.GameSessionPreview]:
        # user=None означает "все активные сессии" и используется только
        # внутренними вызовами (обсервер-комнаты). Роуты обязаны передавать
        # current_user, иначе список утечёт целиком.
        async for db in get_db():
            stmt = (
                select(models.GameSession)
                .options(
                    selectinload(models.GameSession.scenario),
                    selectinload(models.GameSession.scenario).selectinload(models.Scenario.user),
                    selectinload(models.GameSession.master),
                    selectinload(models.GameSession.players).selectinload(models.Player.user),
                )
                .where(models.GameSession.is_active == True)
            )
            if user:
                from sqlalchemy import or_

                stmt = stmt.where(
                    or_(
                        models.GameSession.master_id == user.id,
                        models.GameSession.players.any(models.Player.user_id == user.id),
                    )
                )

            result = await db.execute(stmt)
            db_sessions = list(result.scalars().all())

        previews: List[scheme.GameSessionPreview] = []
        for s in db_sessions:
            if not await self._is_live_approach(s):
                await self._deactivate_stale_approach(s.id)
                continue
            previews.append(scheme.GameSessionPreview.model_validate(s))
        return previews

    async def _is_live_approach(self, gs: models.GameSession) -> bool:
        """True only if Redis runtime still belongs to this approach session.

        For launched worlds, `release_approach_runtime` clears `approach_session_id`
        but keeps `runtime.id` (last approach) for resume — so we must not treat
        a cleared binding as live via the id fallback.
        """
        mgr = await self.ensure_manager(str(gs.id))
        if not await mgr.session_exists():
            return False
        try:
            runtime = await mgr.get_runtime()
        except Exception:
            return False
        if gs.launched_scenario_id:
            if runtime.approach_session_id is None:
                return False
            return str(runtime.approach_session_id) == str(gs.id)
        return str(runtime.id) == str(gs.id)

    async def _deactivate_stale_approach(self, session_id: UUID) -> None:
        """Heal DB row left is_active after Redis approach was released/replaced."""
        async for db in get_db():
            gs = await db.get(models.GameSession, session_id)
            if not gs or not gs.is_active:
                return
            gs.is_active = False
            if gs.status == models.GameSessionStatus.active:
                gs.status = models.GameSessionStatus.finished_forced
            gs.finished_at = gs.finished_at or datetime.now(timezone.utc)
            await db.commit()
            logger.info("deactivated stale approach session %s", session_id)

    async def create_session(self, lobby: scheme.Lobby) -> scheme.SessionRedirect:
        launched_id = getattr(lobby, "launched_scenario_id", None)
        party_id = getattr(lobby, "party_id", None)
        scenario_id = (
            getattr(lobby, "scenario_id", None)
            or (getattr(lobby, "scenario", None) and getattr(lobby.scenario, "id", None))
        )
        if not scenario_id and not launched_id:
            raise ValueError("lobby has no selected scenario")

        async for db in get_db():
            try:
                if launched_id:
                    return await start_approach(
                        db,
                        lobby=lobby,
                        launched_scenario_id=UUID(str(launched_id)),
                        party_id=UUID(str(party_id)) if party_id else None,
                    )
                return await launch_and_start_approach(
                    db,
                    lobby=lobby,
                    prep_scenario_id=UUID(str(scenario_id)),
                )
            except ConcurrentApproachError as exc:
                logger.warning("blocked concurrent approach: %s", exc)
                raise ValueError(str(exc)) from exc

        return scheme.SessionRedirect(session_id=uuid.uuid4())

    async def find_observer_session_id(self, code: str) -> Optional[str]:
        norm = _norm_code(code)
        for preview in await self.list_sessions():
            sid = str(preview.id)
            mgr = await self.ensure_manager(sid)
            if not await mgr.session_exists():
                continue
            runtime = await mgr.get_runtime()
            for o in runtime.observers or []:
                if _norm_code(o.code) == norm:
                    return sid
        return None

    async def list_observer_rooms(
        self,
        *,
        search: Optional[str] = None,
        sort: Literal["name", "scenario", "master", "players", "created"] = "created",
        order: Literal["asc", "desc"] = "desc",
        viewer: models.User = None,
    ) -> List[scheme.ObserverRoomPreview]:
        # В превью входит код комнаты, то есть полный список — это перечислимый
        # доступ ко всем идущим играм. viewer сужает выдачу до своих сессий;
        # None оставлен для админов и внутренних вызовов.
        q = (search or "").strip().lower()
        rooms: List[scheme.ObserverRoomPreview] = []

        for preview in await self.list_sessions(user=viewer):
            sid = str(preview.id)
            mgr = await self.ensure_manager(sid)
            if not await mgr.session_exists():
                continue
            runtime = await mgr.get_runtime()
            observers = runtime.observers or []
            if not observers:
                continue

            scenario_name = getattr(preview.scenario, "name", None) or ""
            master_name = getattr(preview.master, "full_name", None) or ""
            player_count = len(preview.players or [])

            for o in observers:
                rooms.append(
                    scheme.ObserverRoomPreview(
                        code=o.code,
                        session_id=preview.id,
                        session_name=preview.name,
                        scenario_name=scenario_name,
                        master_name=master_name,
                        player_count=player_count,
                        rule_id_str=preview.rule_id_str,
                        created_at=preview.created_at,
                    )
                )

        if q:
            def matches(r: scheme.ObserverRoomPreview) -> bool:
                hay = " ".join(
                    [
                        r.code,
                        r.session_name,
                        r.scenario_name,
                        r.master_name,
                        r.rule_id_str,
                    ]
                ).lower()
                return q in hay

            rooms = [r for r in rooms if matches(r)]

        reverse = order == "desc"

        def sort_key(r: scheme.ObserverRoomPreview):
            if sort == "name":
                return (r.session_name or "").lower()
            if sort == "scenario":
                return (r.scenario_name or "").lower()
            if sort == "master":
                return (r.master_name or "").lower()
            if sort == "players":
                return r.player_count
            # created
            return r.created_at or datetime.min.replace(tzinfo=timezone.utc)

        rooms.sort(key=sort_key, reverse=reverse)
        return rooms

    async def get_manager_for_observer(self, code: str):
        sid = await self.find_observer_session_id(code)
        if sid:
            return await self.ensure_manager(sid)

        norm = _norm_code(code)
        for manager in self.managers.values():
            manager: CurrentSessionManager
            try:
                obs = await manager.get_observer_recipients()
                if any(_norm_code(o.code) == norm for o in obs):
                    return manager
            except ValueError:
                pass
            except Exception as e:
                raise e

        return None


session_manager = SessionManager()
