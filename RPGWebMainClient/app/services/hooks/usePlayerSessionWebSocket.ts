import { useContext, useMemo, useCallback } from 'react';
import { useSessionsStore } from '../stores/sessions';
import { SessionSocketContext, MISSING_SESSION_SOCKET } from '../providers/SessionWebSocketProvider';
import {
  PLAYER_ROLE, GameSession, TakeItem, DropItem,
  ReadNotifications,
  RunSceneAction,
  SubmitActionStep,
  PatchActionStep,
  CancelSceneAction,
  ChangeNoteStatus,
  MarkDispatchOpened,
  EditDispatch,
  EditOwnedNote,
  AddMessageReply,
  EditMessageReply,
  DeleteMessageReply,
  PlayerCreateNote,
  PlayerPublishNote,
  PlayerReplaceCharacter,
  ReplaceCharacterOption,
} from '@/app/services/types/session';
import { NoteCreate } from '../types2';
import { usePlayerMirrorContext } from '@/app/components/session/masterView/playerMirror/PlayerMirrorContext';
import { usePlayerMirrorProjection } from './usePlayerMirrorProjection';

function usePlayerSessionWebSocketLive(sessionId: string) {
  // Получаем только PlayerSession
  const sessionData = useSessionsStore(
    state => state.sessionsPlayer[sessionId]
  );
  const { 
    session, locations, characters, npcs, items, scenes, notes, message_replies,
    audio_queue, audio_player,
    logs, selfPlayer, isPlayer , notifications, dispatches, actions,     polygon_shown, settings,
    playerSeen,
    presentedEntity,
  } = sessionData || {};

  // Хуки ниже должны вызываться безусловно: throw при отсутствии контекста
  // менял их количество между рендерами (см. MISSING_SESSION_SOCKET).
  const ctx = useContext(SessionSocketContext);
  const { connected, sendAction, sendRequest, pluginUI } = ctx ?? MISSING_SESSION_SOCKET;

  const scene = useMemo(() => 
    scenes?.find(scene =>
      scene.characters.some(character => character.id === selfPlayer?.character_id)
    ),
    [scenes, selfPlayer?.character_id]
  );



  const takeItem = useCallback((item_id: string) => {
    const action: TakeItem = {
      user_role: PLAYER_ROLE,
      msg_type: 'take_item',
      item_id,
    };
    sendAction(action);
  }, [sendAction]);

  const dropItem = useCallback((item_id: string) => {
    const action: DropItem = {
      user_role: PLAYER_ROLE,
      msg_type: 'drop_item',
      item_id,
    };
    sendAction(action);
  }, [sendAction]);


  const readNotififcations = useCallback((notifications_ids: string[]) => {
    const action: ReadNotifications = {
      user_role: PLAYER_ROLE,
      msg_type: 'read_notifications',
      notifications_ids: notifications_ids
    };
    sendAction(action);
  }, [sendAction]);


  const runSceneAction = useCallback((sceneId: string, actionKey: string, params?: Record<string, any>) => {
    const action: RunSceneAction = {
      user_role: PLAYER_ROLE,
      msg_type: 'run_scene_action',
      scene_id: sceneId,
      action_key: actionKey,
      ...(params !== undefined && { params }),
    };
    sendAction(action);
  }, [sendAction]);


  const submitActionStep = useCallback((actionId: string, input: Record<string, any>) => {
    const action: SubmitActionStep /* SubmitActionStep */ = {
      user_role: PLAYER_ROLE,
      msg_type: 'submit_action_step',
      action_id: actionId,
      input: input ?? {},
    };
    sendAction(action);
  }, [sendAction]);

  const patchActionStep = useCallback((actionId: string, input: Record<string, any>) => {
    const action: PatchActionStep = {
      user_role: PLAYER_ROLE,
      msg_type: 'patch_action_step',
      action_id: actionId,
      input: input ?? {},
    };
    sendAction(action);
  }, [sendAction]);

  const cancelSceneAction = useCallback((action_id: string) => {
    const action: CancelSceneAction = {
      user_role: PLAYER_ROLE,
      msg_type: 'cancel_action_step',
      action_id,
    };
    sendAction(action);
  }, [sendAction]);


  const changeNoteStatus = useCallback((note_id: string, status: string | null) => {
    if (status != "pending" && status != null) {
      return ;
    }
    const action: ChangeNoteStatus /* SubmitActionStep */ = {
      user_role: PLAYER_ROLE,
      msg_type: 'change_note_status',
      note_id: note_id,
      status: status,
    };
    sendAction(action);
  }, [sendAction]);

  const dispatchNote = useCallback((
    note: NoteCreate,
    character_ids: string[] = [],
    include_master = true,
  ) => {
    sendAction({
      user_role: PLAYER_ROLE,
      msg_type: 'dispatch_note',
      note,
      character_ids,
      include_master,
    });
  }, [sendAction]);

  const markDispatchOpened = useCallback((dispatch_id: string) => {
    const action: MarkDispatchOpened = {
      user_role: PLAYER_ROLE,
      msg_type: 'mark_dispatch_opened',
      dispatch_id,
    };
    sendAction(action);
  }, [sendAction]);

  const editNote = useCallback((note_id: string, note: NoteCreate) => {
    const action: EditOwnedNote = {
      user_role: PLAYER_ROLE,
      msg_type: 'edit_note',
      note_id,
      note,
    };
    sendAction(action);
  }, [sendAction]);

  const playerCreateNote = useCallback((note: NoteCreate) => {
    const action: PlayerCreateNote = {
      user_role: PLAYER_ROLE,
      msg_type: 'note_create',
      note,
    };
    sendAction(action);
  }, [sendAction]);

  const publishNote = useCallback((
    note_id: string,
    characters_ids: string[],
    include_master = true,
  ) => {
    const action: PlayerPublishNote = {
      user_role: PLAYER_ROLE,
      msg_type: 'note_shown',
      note_id,
      characters_ids,
      include_master,
    };
    sendAction(action);
  }, [sendAction]);

  const addMessageReply = useCallback((note_id: string, text: string) => {
    const action: AddMessageReply = {
      user_role: PLAYER_ROLE,
      msg_type: 'add_message_reply',
      note_id,
      text,
    };
    sendAction(action);
  }, [sendAction]);

  const editMessageReply = useCallback((reply_id: string, text: string) => {
    const action: EditMessageReply = {
      user_role: PLAYER_ROLE,
      msg_type: 'edit_message_reply',
      reply_id,
      text,
    };
    sendAction(action);
  }, [sendAction]);

  const deleteMessageReply = useCallback((reply_id: string) => {
    const action: DeleteMessageReply = {
      user_role: PLAYER_ROLE,
      msg_type: 'delete_message_reply',
      reply_id,
    };
    sendAction(action);
  }, [sendAction]);

  const editDispatch = useCallback((dispatch_id: string, note: NoteCreate) => {
    const action: EditDispatch = {
      user_role: PLAYER_ROLE,
      msg_type: 'edit_dispatch',
      dispatch_id,
      note,
    };
    sendAction(action);
  }, [sendAction]);

  const listReplaceCharacterOptions = useCallback(async (): Promise<ReplaceCharacterOption[]> => {
    const res = await sendRequest<{ options: ReplaceCharacterOption[] }>({
      user_role: PLAYER_ROLE,
      msg_type: 'list_replace_characters',
    });
    return res?.options ?? [];
  }, [sendRequest]);

  const replaceCharacter = useCallback((character_id: string, application_id?: string | null) => {
    const action: PlayerReplaceCharacter = {
      user_role: PLAYER_ROLE,
      msg_type: 'player_replace_character',
      character_id,
      ...(application_id ? { application_id } : {}),
    };
    sendAction(action);
  }, [sendAction]);

  // Мемоизация результата
  return useMemo(() => ({
    connected, selfPlayer,
    session, locations, characters, npcs, items, scene, scenes, notes, message_replies, logs, polygon_shown,
    isPlayer, notifications, dispatches, actions, settings, audio_queue, audio_player, pluginUI, playerSeen, presentedEntity,
    takeItem, dropItem, runSceneAction, changeNoteStatus, dispatchNote, markDispatchOpened, editDispatch,
    editNote, playerCreateNote, publishNote,
    addMessageReply, editMessageReply, deleteMessageReply,
    readNotififcations, sendRequest, submitActionStep, patchActionStep, cancelSceneAction,
    listReplaceCharacterOptions, replaceCharacter,
  }), [
    connected, selfPlayer, session, locations, characters, npcs, items, polygon_shown,
    scene, scenes, notes, message_replies, logs, isPlayer, notifications, dispatches, actions, settings, audio_queue, audio_player, pluginUI, playerSeen, presentedEntity,
    takeItem, dropItem, runSceneAction, changeNoteStatus, dispatchNote, markDispatchOpened, editDispatch,
    editNote, playerCreateNote, publishNote,
    addMessageReply, editMessageReply, deleteMessageReply,
    readNotififcations, sendRequest, submitActionStep, patchActionStep, cancelSceneAction,
    listReplaceCharacterOptions, replaceCharacter,
  ]);
}

export function usePlayerSessionWebSocket(sessionId: string) {
  const mirror = usePlayerMirrorContext();
  const projection = usePlayerMirrorProjection(
    sessionId,
    mirror?.enabled ? mirror.playerUserId : null,
  );
  const live = usePlayerSessionWebSocketLive(sessionId);
  if (mirror?.enabled) return projection;
  return live;
}
