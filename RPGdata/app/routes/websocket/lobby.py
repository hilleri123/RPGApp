
from fastapi import HTTPException, Depends, APIRouter, WebSocket, WebSocketDisconnect
from pydantic import schema_json_of
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi.security import OAuth2PasswordRequestForm
import json
from sqlalchemy.future import select
from typing import Optional, List, Literal, Any, Dict
from fastapi import status, WebSocketException

from app import models, scheme
from app.scheme import lobby as lobby_scheme
from app.infrastructure.database import get_async_session as get_db
from app.auth import get_current_user, get_current_user_ws
from app.managers import lobby_manager, master_connection_manager
from app.managers.connection_manager import is_websocket_gone
from app.infrastructure.redis_service import redis_client
from app.logger import logger
from app.services.bot_notify_service import schedule_lobby_invited, schedule_session_started
from sqlalchemy import or_



router = APIRouter(prefix="/lobby", tags=["lobby"])


async def _notify_lobby_closed_and_delete(lobby_m, connection_manager) -> None:
    try:
        members = await lobby_m.get_recipients()
        for member in members:
            try:
                await connection_manager.send_json(member.id, {"msg_type": "lobby_closed"})
            except Exception:
                pass
    finally:
        await lobby_m.delete_lobby()


def online_user_ids(lobby: scheme.Lobby, connection_manager) -> list:
    """Кто из участников лобби прямо сейчас подключён. Это не поле Redis: оно
    считается по живым сокетам при каждой рассылке."""
    ids = []
    seen = set()

    def add(user) -> None:
        if user is None or user.id in seen:
            return
        seen.add(user.id)
        if connection_manager.is_online(user.id):
            ids.append(user.id)

    add(lobby.master)
    for u in lobby.invited_users or []:
        add(u)
    for u in lobby.users or []:
        add(u)
    for p in lobby.players or []:
        add(p.user)
    return ids


async def lobby_payload(lobby_m, connection_manager) -> Optional[Dict[str, Any]]:
    try:
        lobby = await lobby_m.get_lobby()
        lobby.online_user_ids = online_user_ids(lobby, connection_manager)
        return lobby.model_dump(mode="json")
    except Exception:
        logger.exception("get_lobby validation failed, using raw redis state")
        return await redis_client.json().get(lobby_m._lobby_key())


async def broadcast_lobby(lobby_m, connection_manager) -> None:
    payload = await lobby_payload(lobby_m, connection_manager)
    if not payload:
        return
    for member in await lobby_m.get_recipients():
        await connection_manager.send_json(member.id, payload)


async def _send_error(connection_manager, user_id, code: str, message: str) -> None:
    err = scheme.LobbyError(code=code, message=message)
    await connection_manager.send_json(user_id, err.model_dump(mode="json"))


async def _invite_user(lobby_m, connection_manager, master: models.User, target_id) -> bool:
    if target_id == master.id:
        await _send_error(connection_manager, master.id, "invite_failed", "Мастер уже в лобби")
        return False
    target = None
    async for session in get_db():
        target = (
            await session.execute(select(models.User).where(models.User.id == target_id))
        ).scalars().first()
    if target is None or not target.is_active:
        await _send_error(connection_manager, master.id, "invite_failed", "Пользователь не найден")
        return False
    if await lobby_m.is_player(target):
        await _send_error(connection_manager, master.id, "invite_failed", "Игрок уже в лобби")
        return False
    if not await lobby_m.invite_user(target):
        return False
    lobby = await lobby_m.get_lobby()
    schedule_lobby_invited(
        lobby_id=lobby.id,
        user_ids=[target.id],
        lobby_name=lobby.name,
        master_name=master.full_name,
    )
    return True


@router.websocket("/ws/{lobby_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    lobby_id: str,
    db: AsyncSession = Depends(get_db)
):
    current_user = None
    connection_manager = master_connection_manager["lobby"]
    lobby_m = lobby_manager[lobby_id]
    try:
        await websocket.accept()
        current_user = await get_current_user_ws(websocket, db)

        await connection_manager.connect(current_user.id, websocket)

        if not await lobby_m.lobby_exists():
            await connection_manager.send_json(current_user.id, {"msg_type": "lobby_closed"})
            await connection_manager.disconnect(current_user.id, websocket)
            return

        async def send_all(data: Dict[str, Any]):
            members = await lobby_m.get_recipients()
            for member in members:
                await connection_manager.send_json(member.id, data)

        async def send_all_lobby():
            await broadcast_lobby(lobby_m, connection_manager)

        is_master = await lobby_m.is_master(current_user)
        is_user = await lobby_m.is_user(current_user)
        is_player = await lobby_m.is_player(current_user)
        if all([not is_master, not is_user, not is_player]):
            if await lobby_m.is_banned(current_user):
                err = scheme.LobbyError(
                    code="kicked",
                    message="Мастер закрыл для вас доступ к этому лобби",
                )
                await connection_manager.send_json(current_user.id, err.model_dump(mode="json"))
                await connection_manager.disconnect(current_user.id, websocket)
                return
            if not await lobby_m.is_open() and not await lobby_m.is_invited(current_user):
                await _send_error(
                    connection_manager,
                    current_user.id,
                    "closed",
                    "Лобби закрыто: мастер должен добавить вас или открыть его для всех",
                )
                await connection_manager.disconnect(current_user.id, websocket)
                return
            await lobby_m.add_to_lobby(current_user)

        # Присутствие меняется при каждом входе, в том числе реконнекте игрока,
        # поэтому рассылка не зависит от того, добавляли ли пользователя в список.
        await send_all_lobby()

        while True:
            is_master = await lobby_m.is_master(current_user)
            is_user = await lobby_m.is_user(current_user)
            is_player = await lobby_m.is_player(current_user)

            raw_data = await websocket.receive_json()
            logger.debug(f"{raw_data=}")

            if raw_data.get("msg_type") == "request_sync":
                payload = await lobby_payload(lobby_m, connection_manager)
                if payload:
                    await connection_manager.send_json(current_user.id, payload)
                continue

            action = lobby_scheme.ActionBase.parse_action(raw_data)
            ok = False
            if is_master:
                if isinstance(action, lobby_scheme.MasterSelectScenarioAction):
                    ok = await lobby_m.select_lobby_scenario(action.scenario_id)
                elif isinstance(action, lobby_scheme.MasterSelectLaunchedScenarioAction):
                    ok = await lobby_m.select_lobby_launched_scenario(action.launched_scenario_id)
                elif isinstance(action, lobby_scheme.MasterSelectPartyAction):
                    ok = await lobby_m.select_lobby_party(action.party_id)
                elif isinstance(action, lobby_scheme.MasterSelectCampaignAction):
                    ok = await lobby_m.select_lobby_campaign(action.campaign_id)
                elif isinstance(action, lobby_scheme.MasterSetLobbyOpen):
                    ok = await lobby_m.set_open(action.is_open)
                elif isinstance(action, lobby_scheme.MasterInviteUser):
                    ok = await _invite_user(
                        lobby_m, connection_manager, current_user, action.invite_user_id
                    )
                elif isinstance(action, lobby_scheme.MasterUninviteUser):
                    ok = await lobby_m.uninvite_user(action.invite_user_id)
                elif isinstance(action, lobby_scheme.MasterKickPlayer):
                    ok = await lobby_m.kick_player(action.player_id)
                elif isinstance(action, lobby_scheme.MasterDeselectPlayerCharacter):
                    ok = await lobby_m.force_player_deselect_character(
                        action.player_id,
                        user_id=getattr(action, "user_id", None),
                    )
                    if not ok:
                        err = scheme.LobbyError(
                            code="deselect_character_failed",
                            message="Не удалось сбросить персонажа у игрока",
                        )
                        await connection_manager.send_json(
                            current_user.id,
                            err.model_dump(mode="json"),
                        )
                elif isinstance(action, lobby_scheme.MasterStartSession):
                    try:
                        lobby_before = await lobby_m.get_lobby()
                        data = await lobby_m.start_session()
                        if data:
                            await send_all(data.model_dump(mode="json"))
                            schedule_session_started(
                                session_id=data.session_id,
                                user_ids=[
                                    p.user.id
                                    for p in (lobby_before.players or [])
                                    if p.user and p.user.id != current_user.id
                                ],
                                lobby_name=lobby_before.name,
                                scenario_name=getattr(lobby_before.scenario, "name", None),
                            )
                        else:
                            err = scheme.LobbyError(
                                code="start_session_failed",
                                message=(
                                    "Не удалось запустить сессию. "
                                    "Проверьте готовность игроков и выбор сценария."
                                ),
                            )
                            await connection_manager.send_json(
                                current_user.id,
                                err.model_dump(mode="json"),
                            )
                    except ValueError as exc:
                        msg = str(exc)
                        code = "start_session_failed"
                        if "already has active approach" in msg:
                            code = "concurrent_approach"
                            session_part = msg.rsplit(" ", 1)[-1]
                            msg = (
                                "У этого запущенного сценария уже есть активный подход. "
                                f"Завершите сессию {session_part} или выберите другой сценарий."
                            )
                        err = scheme.LobbyError(code=code, message=msg)
                        await connection_manager.send_json(
                            current_user.id,
                            err.model_dump(mode="json"),
                        )
                elif isinstance(action, lobby_scheme.MasterCloseLobby):
                    if await lobby_m.is_master(current_user):
                        await _notify_lobby_closed_and_delete(lobby_m, connection_manager)
                        break
            elif is_user:
                if isinstance(action, lobby_scheme.UserBecomePlayerAction):
                    ok = await lobby_m.became_player(current_user, action.player)
                elif isinstance(action, lobby_scheme.UserLeave):
                    ok = await lobby_m.remove_user(current_user)
            elif is_player:
                if isinstance(action, lobby_scheme.PlayerSelectCharacterAction):
                    ok = await lobby_m.player_select_character(current_user, action.character_id)
                elif isinstance(action, lobby_scheme.PlayerSelectApplicationCharacterAction):
                    ok = await lobby_m.player_select_application_character(
                        current_user, action.application_id
                    )
                elif isinstance(action, lobby_scheme.PlayerDeselectCharacterAction):
                    ok = await lobby_m.player_deselect_character(current_user)
                elif isinstance(action, lobby_scheme.PlayerReady):
                    ok = await lobby_m.player_ready(current_user, action.is_ready)
                elif isinstance(action, lobby_scheme.SelectColor):
                    ok = await lobby_m.player_select_color(current_user, action.color)
                
            # Рассылка сообщения всем участникам комнаты
            if ok:
                await send_all_lobby()

    except WebSocketException as e:
        # нет токена / политика / и т.п.
        logger.warning(f"WebSocket policy error: code={e.code}, reason={e.reason}")
        try:
            await websocket.close(code=e.code)
        except Exception:
            pass
    except WebSocketDisconnect:
        pass
    except RuntimeError as e:
        if not is_websocket_gone(e):
            logger.exception("lobby websocket error")
            try:
                await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
            except Exception:
                pass
    except Exception:
        logger.exception("lobby websocket error")
        try:
            await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        except Exception:
            pass
    finally:
        if current_user is not None:
            await connection_manager.disconnect(current_user.id, websocket)
            try:
                if await lobby_m.lobby_exists():
                    # Закрытая вкладка не должна выкидывать человека, у которого
                    # открыта вторая: список «ожидающих» чистим по последнему сокету.
                    if not connection_manager.is_online(current_user.id):
                        await lobby_m.remove_from_lobby(current_user)
                    await broadcast_lobby(lobby_m, connection_manager)
            except Exception:
                pass


@router.post("")
@router.post("/")
async def create_lobby(
    lobby_to_create: scheme.LobbyCreate,
    current_user: models.User = Depends(get_current_user)
    ) -> scheme.Lobby:
    # if await lobby_manager.lobby_exists(lobby_to_create.name):
    #     raise HTTPException(status_code=400, detail="Lobby already exists")
    
    return await lobby_manager.create_lobby(lobby_to_create, current_user)


@router.get("", response_model=List[scheme.LobbyPreview])
@router.get("/", response_model=List[scheme.LobbyPreview])
async def list_lobbies(
    current_user: models.User = Depends(get_current_user),
    ):
    return await lobby_manager.list_lobbies(current_user.id)


@router.get("/{lobby_id}/user_search", response_model=List[scheme.LobbyUserHit])
async def search_users_to_invite(
    lobby_id: str,
    q: str = "",
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Поиск игроков по имени или Telegram-нику для приглашения в лобби (только мастер)."""
    lobby_m = lobby_manager[lobby_id]
    if not await lobby_m.lobby_exists():
        raise HTTPException(status_code=404, detail="lobby not found")
    if not await lobby_m.is_master(current_user):
        raise HTTPException(status_code=403, detail="only lobby master can invite")

    needle = q.strip().lstrip("@")
    if len(needle) < 2:
        return []
    # Совпадения по email намеренно не ищем: по префиксу это перебор чужих адресов.
    escaped = needle.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    pattern = "%" + escaped + "%"
    stmt = (
        select(models.User)
        .where(
            models.User.is_active.is_not(False),
            models.User.id != current_user.id,
            or_(
                models.User.full_name.ilike(pattern, escape="\\"),
                models.User.tg.ilike(pattern, escape="\\"),
            ),
        )
        .order_by(models.User.full_name.asc().nulls_last())
        .limit(10)
    )
    rows = (await db.execute(stmt)).scalars().all()
    invited = {str(u.get("id")) for u in await lobby_m._get_field("invited_users", [])}
    return [
        scheme.LobbyUserHit(
            id=u.id,
            full_name=u.full_name,
            tg=u.tg,
            icon_url=u.icon_url,
            has_telegram=u.telegram_id is not None,
        )
        for u in rows
        if str(u.id) not in invited
    ]



@router.delete("/{lobby_id}")
async def delete_lobby(
    lobby_id: str,
    current_user: models.User = Depends(get_current_user),
):
    lobby_m = lobby_manager[lobby_id]
    if not await lobby_m.lobby_exists():
        raise HTTPException(status_code=404, detail="lobby not found")

    if not await lobby_m.is_master(current_user):
        raise HTTPException(status_code=403, detail="only lobby master can close lobby")

    connection_manager = master_connection_manager["lobby"]
    await _notify_lobby_closed_and_delete(lobby_m, connection_manager)
    return {"status": "deleted"}



