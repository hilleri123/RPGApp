from uuid import UUID
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, WebSocketException, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user, get_current_user_ws
from app.managers import observer_channels, ChannelKey, session_manager, master_connection_manager
from app.managers.connection_manager import is_websocket_gone
from app.infrastructure.database import get_async_session as get_db
from app import models, scheme
from app.logger import logger
from fastapi import status

# новые ws сообщения
from app.routes._helpers import validate_entity_data
from app.routes.websocket.ws_rpc import SessionWsRpcHandler
from app.scheme.session.ws_messages import (
    MasterSessionInit, MasterSessionUpdate,
    PlayerSessionInit, PlayerSessionUpdate,
)

router = APIRouter(prefix="/session", tags=["session"])




# Поля WS-апдейтов, которых нет в GameSessionInner (runtime / per-player DB).
_WS_EXTRA_UPDATE_FIELDS = frozenset({
    "player_seen",
    "data_revealed_entities",
    "self_player",
})


def _normalize_fields(fields: list[str]) -> list[str]:
    allowed = set(scheme.GameSessionInner.model_fields.keys()) | _WS_EXTRA_UPDATE_FIELDS
    return [f for f in fields if f in allowed]



@router.websocket("/ws/{session_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    session_id: str,
    db: AsyncSession = Depends(get_db)
):

    connection_manager = master_connection_manager["session"]
    session_m = await session_manager.ensure_manager(session_id)
    current_user = None
    try:
        await websocket.accept()
        current_user = await get_current_user_ws(websocket, db)

        logger.debug("session websocket connected!")

        await connection_manager.connect(current_user.id, websocket)

        
        async for db in get_db():
            gs = await db.get(models.GameSession, UUID(str(session_id)))
        if gs and not gs.is_active:
            await connection_manager.send_json(
                current_user.id,
                {
                    "msg_type": "session_finished",
                    "session_id": str(session_id),
                },
            )
            await connection_manager.disconnect(current_user.id, websocket)
            return

        if not await session_m.session_exists():
            await connection_manager.send_json(
                current_user.id,
                {
                    "msg_type": "session_not_found",
                    "session_id": str(session_id),
                },
            )
            logger.warning(f"WS close: session not exists {session_id=}, user={current_user.id}")
            await connection_manager.disconnect(current_user.id, websocket)
            # await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        # роль текущего пользователя
        is_master = await session_m.is_master(current_user)
        is_player = await session_m.is_player(current_user)
        if not (is_master or is_player):
            await connection_manager.disconnect(current_user.id, websocket)
            logger.warning(f"WS close: forbidden {session_id=}, user={current_user.id}, {is_master=} {is_player=}")
            # await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        async def send_init_to_current():
            if is_master:
                msg: MasterSessionInit = await session_m.build_master_init()
                await connection_manager.send_json(current_user.id, msg.model_dump(mode="json"))
            else:
                msg: PlayerSessionInit = await session_m.build_player_init(current_user.id)
                await connection_manager.send_json(current_user.id, msg.model_dump(mode="json"))

        async def broadcast_updates(fields: list[str]):
            fields = _normalize_fields(fields)

            master_fields = session_m._filter_fields_for_master(fields)
            player_fields = session_m._filter_fields_for_player(fields)

            # если ничего релевантного — не шлём
            if not master_fields and not player_fields:
                return

            members = await session_m.get_recipients()

            master_msg = None
            player_msg = None

            # собираем payload 1 раз на рассылку, не на каждого пользователя
            if master_fields:
                master_msg = await session_m.build_master_update(master_fields)
                master_payload = master_msg.model_dump(mode="json")


            for member in members:
                if player_fields:
                    player_msg = await session_m.build_player_update(member.id, player_fields)
                    player_payload = player_msg.model_dump(mode="json")
                try:
                    if master_msg is not None and await session_m.is_master(member):
                        await connection_manager.send_json(member.id, master_payload)
                    elif player_msg is not None and await session_m.is_player(member):
                        await connection_manager.send_json(member.id, player_payload)
                except Exception as e:
                    logger.exception(f"send_json failed to user={getattr(member, 'id', None)}: {e}")


        async def broadcast_observer_updates(fields: list[str]) -> None:
            fields = session_m._filter_fields_for_observer(fields)
            if not fields:
                return

            observers = await session_m.get_observer_recipients()
            if not observers:
                return

            for o in observers:
                code = getattr(o, "code", None)
                if not code:
                    continue

                msg = await session_m.build_observer_update(str(code), fields)
                payload = msg.model_dump(mode="json")  # важно [web:189]
                await observer_channels.broadcast_json(ChannelKey(code=str(code)), payload)



        # initial payload (role-based)
        await send_init_to_current()

        rpc = SessionWsRpcHandler(
            db=db,
            session_m=session_m,
            current_user=current_user,
            is_master=is_master,
            send_json_to_current=lambda payload: connection_manager.send_json(current_user.id, payload),
        )

        while True:
            raw_data = await websocket.receive_json()

            logger.debug(f"{is_master=} {is_player=} {raw_data=}")
            if await rpc.try_handle(raw_data):
                continue

            if raw_data.get("msg_type") == "request_sync":
                await send_init_to_current()
                continue

            if raw_data.get("msg_type") == "reload_entities" and is_master:
                fields = _normalize_fields(raw_data.get("fields") or [])
                await session_m.invalidate_entity_cache()
                await broadcast_updates(fields)
                continue

            action = scheme.SessionActionBase.parse_action(raw_data)
            logger.debug(f"{action=}")

            ok = False
            fields: list[str] = []

            if is_master:
                if isinstance(action, scheme.SetLocationCheck):
                    ok, fields = await session_m.change_polygon_visibility(
                        action.location_id, action.polygon_id, action.is_visible
                    )
                elif isinstance(action, scheme.SetNoteCheck):
                    ok, fields = await session_m.set_note_check(
                        current_user, action.note_id, action.is_checked
                    )
                elif isinstance(action, scheme.MakeNPCDead):
                    ok, fields = await session_m.make_npc_dead(action.npc_id, action.is_dead)
                elif isinstance(action, scheme.MoveToScene):
                    ok, fields = await session_m.move_to_scene(action.scene_id, action.npc_id, action.item_id)
                elif isinstance(action, scheme.MoveOutScene):
                    ok, fields = await session_m.move_out_scene(action.scene_id, action.npc_id, action.item_id, action.obstacle_id)
                elif isinstance(action, scheme.AddScene):
                    ok, fields = await session_m.scene_from_location(action.location_id)
                elif isinstance(action, scheme.UpdateSceneData):
                    ok, fields = await session_m.update_scene_data(action.scene_id, action.data)
                elif isinstance(action, scheme.DelScene):
                    ok, fields = await session_m.del_scene(action.scene_id)
                elif isinstance(action, scheme.ExpandScene):
                    ok, fields = await session_m.expand_scene(action.scene_id)
                elif isinstance(action, scheme.CollapseScene):
                    ok, fields = await session_m.collapse_scene(action.scene_id)
                elif isinstance(action, scheme.SetSceneLocation):
                    ok, fields = await session_m.set_scene_location(action.scene_id, action.location_id)
                elif isinstance(action, scheme.MoveCharacterToScene):
                    ok, fields = await session_m.move_character_to_scene(action.scene_id, action.character_id)
                elif isinstance(action, scheme.SetSceneTime):
                    ok, fields = await session_m.set_scene_time(action.scene_id, action.time)
                elif isinstance(action, scheme.SetSessionTime):
                    ok, fields = await session_m.set_session_time(action.time)
                elif isinstance(action, scheme.MakeElementPublic):
                    ok, fields = await session_m.make_element_public(action.scene_id, action.public, action.npc_id, action.item_id, action.obstacle_id)
                elif isinstance(action, scheme.MasterMoveItem):
                    ok, fields = await session_m.move_item(current_user, action.item_id, action.to_character_id, action.to_npc_id, action.to_location_id)
                elif isinstance(action, scheme.MasterCreateObstacle):
                    ok, fields = await session_m.create_obstacle(current_user, action.scene_id, action.obstacle)
                elif isinstance(action, scheme.MasterUpdateObstacle):
                    ok, fields = await session_m.update_obstacle(current_user, action.scene_id, action.obstacle)
                elif isinstance(action, scheme.MasterReadNotifications):
                    ok, fields = await session_m.read_notifications(current_user, action.notifications_ids)
                elif isinstance(action, scheme.NoteShownAction):
                    ok, fields = await session_m.show_note(current_user, action.note_id, action.characters_ids)
                elif action.msg_type == 'note_create':
                    ok, fields = await session_m.create_note(current_user, action.note)
                elif action.msg_type == 'edit_note':
                    ok, fields = await session_m.edit_note(current_user, action.note_id, action.note)
                elif action.msg_type == 'add_message_reply':
                    ok, fields = await session_m.add_message_reply(current_user, action.note_id, action.text)
                elif action.msg_type == 'edit_message_reply':
                    ok, fields = await session_m.edit_message_reply(current_user, action.reply_id, action.text)
                elif action.msg_type == 'delete_message_reply':
                    ok, fields = await session_m.delete_message_reply(current_user, action.reply_id)
                elif isinstance(action, scheme.RevokeDispatch):
                    ok, fields = await session_m.revoke_dispatch(current_user, action.dispatch_id)
                elif isinstance(action, scheme.EditDispatch):
                    ok, fields = await session_m.edit_dispatch(
                        current_user, action.dispatch_id, action.note
                    )
                elif isinstance(action, scheme.MarkDispatchOpened):
                    ok, fields = await session_m.mark_dispatch_opened(current_user, action.dispatch_id)
                elif isinstance(action, scheme.MasterChangeNoteStatus):
                    ok, fields = await session_m.change_note_status(
                        current_user, action.note_id, action.status
                    )
                elif isinstance(action, scheme.RunSceneAction):
                    ok, fields = await session_m.run_scene_action(
                        current_user=current_user,
                        scene_id=action.scene_id,
                        action_key=action.action_key,
                    )
                elif isinstance(action, scheme.SubmitActionStep):
                    ok, fields = await session_m.submit_action_step(
                        current_user=current_user,
                        action_id=action.action_id,
                        input_data=action.input,
                    )
                elif isinstance(action, scheme.PatchActionStep):
                    ok, fields = await session_m.patch_action_step(
                        current_user=current_user,
                        action_id=action.action_id,
                        input_data=action.input,
                    )
                elif isinstance(action, scheme.CancelSceneAction):
                    ok, fields = await session_m.cancel_action(current_user=current_user, action_id=action.action_id)
                elif isinstance(action, scheme.ApplyExposition):
                    ok, fields = await session_m.apply_exposition(current_user, scene_id=action.scene_id, exposition_id=action.exposition_id, from_location_id=action.from_location_id, from_story_beat=action.from_story_beat)
                elif isinstance(action, scheme.MasterToggleLocationHidden):
                    ok, fields = await session_m.toggle_location_hidden(current_user=current_user, location_id=action.location_id, hidden=action.hidden)
                elif isinstance(action, scheme.CreateObserver):
                    ok, fields = await session_m.add_observer(current_user=current_user)
                elif isinstance(action, scheme.UpdateObserver):
                    ok, fields = await session_m.update_observer(current_user=current_user, observer=action.observer)
                elif isinstance(action, scheme.DeleteObserver):
                    ok, fields = await session_m.delete_observer(current_user=current_user, code=action.code)
                elif isinstance(action, scheme.MasterSetSettings):
                    ok, fields = await session_m.set_settings(current_user, settings=action.settings)
                elif isinstance(action, scheme.MasterSetDefaultSettings):
                    ok, fields = await session_m.reset_settings(current_user)
                elif isinstance(action, scheme.CreateFactoryObject):
                    ok, fields = await session_m.create_factory_object(current_user, kind=action.kind, object_id=action.object_id, scene_id=action.scene_id)
                elif isinstance(action, scheme.AudioCommand):
                    ok, fields = await session_m.audio_command(current_user, action.command)
                elif isinstance(action, scheme.AudioCommandPlayEntry):
                    ok, fields = await session_m.audio_command(current_user, "play_entry", action.entry_id)
                elif isinstance(action, scheme.AudioCommandSetVolume):                          # ← NEW
                    ok, fields = await session_m.audio_command(current_user, "set_volume", extra={"volume": action.volume})
                elif isinstance(action, scheme.AudioCommandSyncPosition):                       # ← NEW
                    ok, fields = await session_m.audio_command(current_user, "sync_position", extra={"position_sec": action.position_sec})
                elif isinstance(action, scheme.AudioCommandEnqueueTrack):
                    ok, fields = await session_m.enqueue_audio_track(
                        current_user,
                        action.audio_track_id,
                        play=action.play,
                    )
                elif isinstance(action, scheme.PresentEntity):
                    ok, fields = await session_m.present_entity(
                        current_user,
                        scene_id=action.scene_id,
                        entity_type=action.entity_type,
                        entity_id=action.entity_id,
                        data_access=action.data_access,
                    )
                elif isinstance(action, scheme.GrantEntityDataAccess):
                    ok, fields = await session_m.grant_entity_data_access(
                        current_user,
                        scene_id=action.scene_id,
                        entity_type=action.entity_type,
                        entity_id=action.entity_id,
                    )
                elif isinstance(action, scheme.RevokeEntityDataAccess):
                    ok, fields = await session_m.revoke_entity_data_access(
                        current_user,
                        scene_id=action.scene_id,
                        entity_type=action.entity_type,
                        entity_id=action.entity_id,
                    )
                elif isinstance(action, scheme.DismissPresentedEntity):
                    ok, fields = await session_m.dismiss_presented_entity(current_user)
                elif isinstance(action, scheme.MasterKickPlayer):
                    ok, fields = await session_m.master_kick_player(current_user, action.player_id)
                elif isinstance(action, scheme.MasterDeselectPlayerCharacter):
                    ok, fields = await session_m.master_deselect_character(current_user, action.player_id)
                elif isinstance(action, scheme.MasterAssignPlayerCharacter):
                    ok, fields = await session_m.master_assign_character(
                        current_user, action.player_id, action.character_id,
                    )
                elif isinstance(action, scheme.MasterSetPlayerColor):
                    ok, fields = await session_m.master_set_player_color(
                        current_user, action.player_id, action.color,
                    )
                else:
                    # неизвестное/неразрешённое действие мастера
                    ok = False

            else:  # player
                if isinstance(action, scheme.PlayerDropItem):
                    ok, fields = await session_m.drop_item(current_user, action.item_id)
                elif isinstance(action, scheme.PlayerTakeItem):
                    ok, fields = await session_m.take_item(current_user, action.item_id)
                elif isinstance(action, scheme.PlayerChangeNoteStatus):
                    ok, fields = await session_m.change_note_status(
                        current_user, action.note_id, action.status
                    )
                elif isinstance(action, scheme.PlayerCreateNote):
                    ok, fields = await session_m.player_create_note(current_user, action.note)
                elif isinstance(action, scheme.PlayerPublishNote):
                    ok, fields = await session_m.show_note(
                        current_user,
                        action.note_id,
                        action.characters_ids,
                        action.include_master,
                    )
                elif action.msg_type == 'edit_note':
                    ok, fields = await session_m.edit_note(current_user, action.note_id, action.note)
                elif action.msg_type == 'add_message_reply':
                    ok, fields = await session_m.add_message_reply(current_user, action.note_id, action.text)
                elif action.msg_type == 'edit_message_reply':
                    ok, fields = await session_m.edit_message_reply(current_user, action.reply_id, action.text)
                elif action.msg_type == 'delete_message_reply':
                    ok, fields = await session_m.delete_message_reply(current_user, action.reply_id)
                elif isinstance(action, scheme.PlayerDispatchNote):
                    ok, fields = await session_m.player_dispatch_note(
                        current_user,
                        action.note,
                        action.character_ids,
                        action.include_master,
                    )
                elif isinstance(action, scheme.PlayerMarkDispatchOpened):
                    ok, fields = await session_m.mark_dispatch_opened(current_user, action.dispatch_id)
                elif isinstance(action, scheme.PlayerEditDispatch):
                    ok, fields = await session_m.edit_dispatch(
                        current_user, action.dispatch_id, action.note
                    )
                elif isinstance(action, scheme.PlayerReadNotifications):
                    ok, fields = await session_m.read_notifications(current_user, action.notifications_ids)
                elif isinstance(action, scheme.PlayerRunSceneAction):
                    ok, fields = await session_m.run_scene_action(
                        current_user=current_user,
                        scene_id=action.scene_id,
                        action_key=action.action_key,
                    )
                elif isinstance(action, scheme.PlayerSubmitActionStep):
                    ok, fields = await session_m.submit_action_step(
                        current_user=current_user,
                        action_id=action.action_id,
                        input_data=action.input,
                    )
                elif isinstance(action, scheme.PlayerPatchActionStep):
                    ok, fields = await session_m.patch_action_step(
                        current_user=current_user,
                        action_id=action.action_id,
                        input_data=action.input,
                    )
                elif isinstance(action, scheme.PlayerCancelSceneAction):
                    ok, fields = await session_m.cancel_action(
                        current_user=current_user,
                        action_id=action.action_id,
                    )
                elif isinstance(action, scheme.PlayerReplaceCharacter):
                    ok, fields = await session_m.replace_character(
                        current_user,
                        new_character_id=action.character_id,
                        application_id=action.application_id,
                    )
                else:
                    ok = False

            if ok:
                await broadcast_updates(fields)
                await broadcast_observer_updates(fields)

    except WebSocketException as e:
        # нет токена / политика / и т.п.
        try:
            await websocket.close(code=e.code)
        except Exception:
            pass
    except WebSocketDisconnect:
        pass
    except RuntimeError as e:
        if not is_websocket_gone(e):
            logger.exception("session websocket error")
            try:
                await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
            except Exception:
                pass
    except Exception:
        logger.exception("session websocket error")
        try:
            await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        except Exception:
            pass
    finally:
        if current_user is not None:
            await connection_manager.disconnect(current_user.id, websocket)


@router.get("", response_model=list[scheme.GameSessionPreview])
@router.get("/", response_model=list[scheme.GameSessionPreview])
async def list_sessions(
    current_user: models.User = Depends(get_current_user)
):
    return await session_manager.list_sessions(current_user)


# GET /{session_id} убран намеренно: он отдавал бы GameSession целиком, без
# ролевой фильтрации полей, которую делают build_master/player_init. Состояние
# сессии клиенты получают только через WebSocket.


@router.delete("/{session_id}")
async def delete_session(
    session_id: str,
    current_user: models.User = Depends(get_current_user)
):
    sm = await session_manager.ensure_manager(session_id)
    if not await sm.session_exists():
        raise HTTPException(status_code=404, detail="session not found")
    if not await sm.is_master(current_user):
        raise HTTPException(status_code=403, detail="only master can delete session")
    await sm.delete_session()
    return {"status": "deleted"}



class FinishSessionPayload(BaseModel):
    forced: bool = False
    close_launched_scenario: bool = False

@router.post("/{session_id}/finish")
async def finish_session(
    session_id: str,
    payload: FinishSessionPayload,
    current_user: models.User = Depends(get_current_user),
):
    sm = await session_manager.ensure_manager(session_id)
    if not await sm.session_exists():
        raise HTTPException(status_code=404, detail="session not found")

    # проверка "только мастер"
    if not await sm.is_master(current_user):
        raise HTTPException(status_code=403, detail="only master can finish session")

    ok, campaign_finish = await sm.finish_session(
        current_user,
        forced=payload.forced,
        close_launched_scenario=payload.close_launched_scenario,
    )
    if not ok:
        raise HTTPException(status_code=400, detail="cannot finish session")

    body: dict = {"status": "finished", "forced": payload.forced}
    if campaign_finish:
        body["campaign"] = campaign_finish.model_dump(mode="json")
    return body
