import { useContext, useMemo, useCallback } from 'react';
import { useSessionsStore } from '../stores/sessions';
import { SessionSocketContext, MISSING_SESSION_SOCKET } from '../providers/SessionWebSocketProvider';
import {
  GameSession, GameSessionBase, MasterAddScene, MasterMoveCharacterToScene,
  MasterSetLocationCheck, MasterMakeNPCDead, MasterMoveToScene, MasterMoveOutScene,
  MasterDelScene, MasterMergeScene, MasterSetMainScene, MasterSetSceneLocation,
  MasterSetSceneTime, MasterSetSessionTime, MasterMakeElementPublic, SessionActionBase, MoveItem,
  Scene, MASTER_ROLE, PLAYER_ROLE, DropItem, TakeItem,
  ReadNotifications,
  NoteShownAction,
  RunSceneAction,
  SubmitActionStep,
  PatchActionStep,
  CancelSceneAction,
  CreateObserver,
  Observer,
  UpdateObserver,
  DeleteObserver,
  SessionSettings,
  MasterSetDefaultSettings,
  MasterSetSettings,
  MasterUpdateSceneData,
  ChangeNoteStatus,
  CreateFactoryObject,
  ApplySceneExposure,
  CreateObstacle,
  UpdateObstacle,
  AudioCommand,
  AudioCommandPlayEntry,
  AudioCommandSetVolume,
  AudioCommandSyncPosition,
  MasterToggleLocationHidden,
  MasterExpandScene,
  MasterCollapseScene,
  AudioCommandEnqueueTrack,
  RevokeDispatch,
  EditDispatch,
  EditOwnedNote,
  AddMessageReply,
  EditMessageReply,
  DeleteMessageReply,
  NoteCreateAction,
  MarkDispatchOpened,
  PresentEntity,
  GrantEntityDataAccess,
  RevokeEntityDataAccess,
  DismissPresentedEntity,
  MasterKickPlayer,
  MasterDeselectPlayerCharacter,
  MasterAssignPlayerCharacter,
  MasterSetPlayerColor,
} from '@/app/services/types/session';
import type { NoteCreate } from '@/app/services/types2';

export function useSessionWebSocket(sessionId: string) {
  // Получаем все данные сессии из zustand-стора
  const sessionData = useSessionsStore(
    state => state.sessions[sessionId]
  );
  const { 
    session, locations, characters, npcs, items, scenes, 
    notes, counters, storyBeats, factories, actions,
    logs, notifications, dispatches, message_replies, observers, settings, polygon_shown, 
    audio_queue, audio_player, timeline, audio,
    selfPlayer, isMaster, isPlayer,
    presentedEntity, dataRevealedEntities, playerSeen,
  } = sessionData || {};

  // Получаем методы ws из провайдера
  // Хуки ниже должны вызываться безусловно: throw при отсутствии контекста
  // менял их количество между рендерами (см. MISSING_SESSION_SOCKET).
  const ctx = useContext(SessionSocketContext);
  const { connected, sendAction, sendRequest, pluginUI } = ctx ?? MISSING_SESSION_SOCKET;

  // Обертки для всех бизнес-действий (через sendAction)
  const setLocationCheck = useCallback((locationId: string, polygonId: string, value: boolean) => {
    const action: MasterSetLocationCheck = {
      user_role: MASTER_ROLE,
      msg_type: 'set_location_check',
      location_id: locationId,
      polygon_id: polygonId,
      is_visible: value
    };
    sendAction(action);
  }, [sendAction]);

  const addScene = useCallback((locationId: string) => {
    const action: MasterAddScene = {
      user_role: MASTER_ROLE,
      msg_type: 'add_scene',
      location_id: locationId,
    };
    sendAction(action);
  }, [sendAction]);

  const updateScene = useCallback((sceneId: string, data: any) => {
    const action: MasterUpdateSceneData = {
      user_role: MASTER_ROLE,
      msg_type: 'update_scene_data',
      scene_id: sceneId,
      data: data,
    };
    sendAction(action);
  }, [sendAction]);

  const delScene = useCallback((sceneId: string) => {
    const action: MasterDelScene = {
      user_role: MASTER_ROLE,
      msg_type: 'del_scene',
      scene_id: sceneId,
    };
    sendAction(action);
  }, [sendAction]);

  const expandScene = useCallback((sceneId: string) => {
    const action: MasterExpandScene = {
      user_role: MASTER_ROLE,
      msg_type: 'scene_expand',
      scene_id: sceneId,
    };
    sendAction(action);
  }, [sendAction]);

  const collapseScene = useCallback((sceneId: string) => {
    const action: MasterCollapseScene = {
      user_role: MASTER_ROLE,
      msg_type: 'scene_collapse',
      scene_id: sceneId,
    };
    sendAction(action);
  }, [sendAction]);

  const moveCharacterToScene = useCallback((characterId: string, sceneId: string) => {
    const action: MasterMoveCharacterToScene = {
      user_role: MASTER_ROLE,
      msg_type: 'move_character_to_scene',
      character_id: characterId,
      scene_id: sceneId,
    };
    sendAction(action);
  }, [sendAction]);

  const makeNPCDead = useCallback((npcId: string, isDead: boolean) => {
    const action: MasterMakeNPCDead = {
      user_role: MASTER_ROLE,
      msg_type: 'make_npc_dead',
      npc_id: npcId,
      is_dead: isDead,
    };
    sendAction(action);
  }, [sendAction]);

  const moveToScene = useCallback((
    sceneId: string,
    npcId?: string,
    itemId?: string
  ) => {
    const socketAction: MasterMoveToScene = {
      user_role: MASTER_ROLE,
      msg_type: 'move_to_scene',
      scene_id: sceneId,
      ...(npcId !== undefined && { npc_id: npcId }),
      ...(itemId !== undefined && { item_id: itemId }),
    };
    sendAction(socketAction);
  }, [sendAction]);

  const moveOutScene = useCallback((
    sceneId: string,
    npcId?: string,
    itemId?: string,
    obstacleId?: string,
  ) => {
    const socketAction: MasterMoveOutScene = {
      user_role: MASTER_ROLE,
      msg_type: 'move_out_scene',
      scene_id: sceneId,
      ...(npcId !== undefined && { npc_id: npcId }),
      ...(itemId !== undefined && { item_id: itemId }),
      ...(obstacleId !== undefined && { obstacle_id: obstacleId }),
    };
    sendAction(socketAction);
  }, [sendAction]);

  const mergeScene = useCallback((sceneId: string, toSceneId: string) => {
    const action: MasterMergeScene = {
      user_role: MASTER_ROLE,
      msg_type: 'merge_scene',
      scene_id: sceneId,
      to_scene_id: toSceneId,
    };
    sendAction(action);
  }, [sendAction]);

  const setMainScene = useCallback((sceneId: string) => {
    const action: MasterSetMainScene = {
      user_role: MASTER_ROLE,
      msg_type: 'set_main_scene',
      scene_id: sceneId,
    };
    sendAction(action);
  }, [sendAction]);

  const setSceneLocation = useCallback((sceneId: string, locationId: string) => {
    const action: MasterSetSceneLocation = {
      user_role: MASTER_ROLE,
      msg_type: 'set_scene_location',
      scene_id: sceneId,
      location_id: locationId,
    };
    sendAction(action);
  }, [sendAction]);

  const setSceneTime = useCallback((sceneId: string, time: string) => {
    const action: MasterSetSceneTime = {
      user_role: MASTER_ROLE,
      msg_type: 'set_scene_time',
      scene_id: sceneId,
      time,
    };
    sendAction(action);
  }, [sendAction]);

  const setSessionTime = useCallback((time: string) => {
    const action: MasterSetSessionTime = {
      user_role: MASTER_ROLE,
      msg_type: 'set_session_time',
      time,
    };
    sendAction(action);
  }, [sendAction]);

  const makeElementPublic = useCallback((
    sceneId: string,
    is_public: boolean,
    npcId?: string,
    itemId?: string,
    obstacleId?: string,
  ) => {
    const action: MasterMakeElementPublic = {
      user_role: MASTER_ROLE,
      msg_type: 'make_element_public',
      scene_id: sceneId,
      ...(npcId !== undefined && { npc_id: npcId }),
      ...(itemId !== undefined && { item_id: itemId }),
      ...(obstacleId !== undefined && { obstacle_id: obstacleId }),
      public: is_public,
    };
    sendAction(action);
  }, [sendAction]);

  const moveItem = useCallback((item_id: string, character_id?: string, npc_id?: string, location_id?: string) => {
    const action: MoveItem = {
      user_role: MASTER_ROLE,
      msg_type: 'move_item',
      item_id,
      to_character_id: character_id,
      to_npc_id: npc_id,
      to_location_id: location_id,
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

  const takeItem = useCallback((item_id: string) => {
    const action: TakeItem = {
      user_role: PLAYER_ROLE,
      msg_type: 'take_item',
      item_id,
    };
    sendAction(action);
  }, [sendAction]);

  const createObstacle = useCallback((sceneId: string, obstacle: any) => {
    const action: CreateObstacle = {
      user_role: MASTER_ROLE,
      msg_type: "create_obstacle",
      scene_id: sceneId,
      obstacle,
    };
    sendAction(action);
  }, [sendAction]);

  const updateObstacle = useCallback((sceneId: string, obstacle: any) => {
    const action: UpdateObstacle = {
      user_role: MASTER_ROLE,
      msg_type: "update_obstacle",
      scene_id: sceneId,
      obstacle,
    };
    sendAction(action);
  }, [sendAction]);

  const showNote = useCallback((note_id: string, characters_ids: string[]) => {
    const action: NoteShownAction = {
      user_role: MASTER_ROLE,
      msg_type: 'note_shown',
      note_id: note_id,
      characters_ids: characters_ids,
    };
    sendAction(action);
  }, [sendAction]);

  const createNote = useCallback((note: NoteCreate) => {
    const action: NoteCreateAction = {
      user_role: MASTER_ROLE,
      msg_type: 'note_create',
      note,
    };
    sendAction(action);
  }, [sendAction]);

  const markDispatchOpened = useCallback((dispatch_id: string) => {
    const action: MarkDispatchOpened = {
      user_role: MASTER_ROLE,
      msg_type: 'mark_dispatch_opened',
      dispatch_id,
    };
    sendAction(action);
  }, [sendAction]);

  const revokeDispatch = useCallback((dispatch_id: string) => {
    const action: RevokeDispatch = {
      user_role: MASTER_ROLE,
      msg_type: 'revoke_dispatch',
      dispatch_id,
    };
    sendAction(action);
  }, [sendAction]);

  const editNote = useCallback((note_id: string, note: NoteCreate) => {
    const action: EditOwnedNote = {
      user_role: MASTER_ROLE,
      msg_type: 'edit_note',
      note_id,
      note,
    };
    sendAction(action);
  }, [sendAction]);

  const addMessageReply = useCallback((note_id: string, text: string) => {
    const action: AddMessageReply = {
      user_role: MASTER_ROLE,
      msg_type: 'add_message_reply',
      note_id,
      text,
    };
    sendAction(action);
  }, [sendAction]);

  const editMessageReply = useCallback((reply_id: string, text: string) => {
    const action: EditMessageReply = {
      user_role: MASTER_ROLE,
      msg_type: 'edit_message_reply',
      reply_id,
      text,
    };
    sendAction(action);
  }, [sendAction]);

  const deleteMessageReply = useCallback((reply_id: string) => {
    const action: DeleteMessageReply = {
      user_role: MASTER_ROLE,
      msg_type: 'delete_message_reply',
      reply_id,
    };
    sendAction(action);
  }, [sendAction]);

  const editDispatch = useCallback((dispatch_id: string, note: NoteCreate) => {
    const action: EditDispatch = {
      user_role: MASTER_ROLE,
      msg_type: 'edit_dispatch',
      dispatch_id,
      note,
    };
    sendAction(action);
  }, [sendAction]);

  const readNotififcations = useCallback((notifications_ids: string[]) => {
    const action: ReadNotifications = {
      user_role: MASTER_ROLE,
      msg_type: 'read_notifications',
      notifications_ids: notifications_ids
    };
    sendAction(action);
  }, [sendAction]);

  const runSceneAction = useCallback((sceneId: string, actionKey: string, params?: Record<string, any>) => {
    const action: RunSceneAction = {
      user_role: isMaster ? MASTER_ROLE : PLAYER_ROLE,
      msg_type: 'run_scene_action',
      scene_id: sceneId,
      action_key: actionKey,
      ...(params !== undefined && { params }),
    };
    sendAction(action);
  }, [sendAction, isMaster]);

  const cancelSceneAction = useCallback((action_id: string) => {
    const action: CancelSceneAction = {
      user_role: isMaster ? MASTER_ROLE : PLAYER_ROLE,
      msg_type: 'cancel_action_step',
      action_id: action_id,
    };
    sendAction(action);
  }, [sendAction, isMaster]);

  const submitActionStep = useCallback((actionId: string, input: Record<string, any>) => {
    const action: SubmitActionStep /* SubmitActionStep */ = {
      user_role: isMaster ? MASTER_ROLE : PLAYER_ROLE,
      msg_type: 'submit_action_step',
      action_id: actionId,
      input: input ?? {},
    };
    sendAction(action);
  }, [sendAction, isMaster]);

  const patchActionStep = useCallback((actionId: string, input: Record<string, any>) => {
    const action: PatchActionStep = {
      user_role: isMaster ? MASTER_ROLE : PLAYER_ROLE,
      msg_type: 'patch_action_step',
      action_id: actionId,
      input: input ?? {},
    };
    sendAction(action);
  }, [sendAction, isMaster]);


  const createObserver = useCallback(() => {
    const action: CreateObserver = {
      user_role: MASTER_ROLE,
      msg_type: 'create_observer',
    };
    sendAction(action);
  }, [sendAction, isMaster]);

  const updateObserver = useCallback((observer: Observer) => {
    const action: UpdateObserver = {
      user_role: MASTER_ROLE,
      msg_type: 'update_observer',
      observer: observer,
    };
    sendAction(action);
  }, [sendAction, isMaster]);

  const deleteObserver = useCallback((code: string) => {
    const action: DeleteObserver = {
      user_role: MASTER_ROLE,
      msg_type: 'delete_observer',
      code: code,
    };
    sendAction(action);
  }, [sendAction, isMaster]);

  const updateSettings = useCallback((settings: SessionSettings) => {
    const action: MasterSetSettings = {
      user_role: MASTER_ROLE,
      msg_type: 'set_settings',
      settings: settings,
    };
    sendAction(action);
  }, [sendAction, isMaster]);

  const setDefaultSettings = useCallback(() => {
    const action: MasterSetDefaultSettings = {
      user_role: MASTER_ROLE,
      msg_type: 'set_default_settings',
    };
    sendAction(action);
  }, [sendAction, isMaster]);

  const masterKickPlayer = useCallback((player_id: string) => {
    const action: MasterKickPlayer = {
      user_role: MASTER_ROLE,
      msg_type: 'kick_player',
      player_id,
    };
    sendAction(action);
  }, [sendAction]);

  const masterDeselectPlayerCharacter = useCallback((player_id: string) => {
    const action: MasterDeselectPlayerCharacter = {
      user_role: MASTER_ROLE,
      msg_type: 'master_deselect_character',
      player_id,
    };
    sendAction(action);
  }, [sendAction]);

  const masterAssignPlayerCharacter = useCallback((player_id: string, character_id: string) => {
    const action: MasterAssignPlayerCharacter = {
      user_role: MASTER_ROLE,
      msg_type: 'master_assign_character',
      player_id,
      character_id,
    };
    sendAction(action);
  }, [sendAction]);

  const masterSetPlayerColor = useCallback((player_id: string, color: string) => {
    const action: MasterSetPlayerColor = {
      user_role: MASTER_ROLE,
      msg_type: 'master_set_player_color',
      player_id,
      color,
    };
    sendAction(action);
  }, [sendAction]);


  const changeNoteStatus = useCallback((note_id: string, status: string | null) => {
    if (status != "completed" && status != null) {
      return ;
    }
    const action: ChangeNoteStatus /* SubmitActionStep */ = {
      user_role: MASTER_ROLE,
      msg_type: 'change_note_status',
      note_id: note_id,
      status: status,
    };
    sendAction(action);
  }, [sendAction]);


  const createFactoryObject = useCallback((scene_id: string | null, kind: 'npc' | 'item' | 'character', entityId: string) => {
    const action: CreateFactoryObject = {
      user_role: MASTER_ROLE,
      msg_type: 'create_factory_object',
      scene_id: scene_id,
      kind: kind,
      object_id: entityId,
    };
    sendAction(action);
  }, [sendAction]);

  const applySceneExposure = useCallback((scene_id: string, exposition_id: string, from_location_id?: string, from_story_beat?: string) => {
    const action: ApplySceneExposure = {
      user_role: MASTER_ROLE,
      msg_type: 'apply_exposition',
      scene_id: scene_id,
      from_location_id: from_location_id,
      from_story_beat: from_story_beat,
      exposition_id: exposition_id,
    };
    sendAction(action);
  }, [sendAction]);


  const audioCommand = useCallback((
    command: 'play' | 'pause' | 'stop' | 'clear_queue'
  ) => {
    const action: AudioCommand = {
      user_role: MASTER_ROLE,
      msg_type: 'audio_command',
      command,
    };
    sendAction(action);
  }, [sendAction]);

  const audioPlayEntry = useCallback((entry_id: string) => {
    const action: AudioCommandPlayEntry = {
      user_role: MASTER_ROLE,
      msg_type: 'audio_command_play_entry',
      entry_id,
    };
    sendAction(action);
  }, [sendAction]);
  
  const setMasterVolume = useCallback((volume: number) => {
    const action: AudioCommandSetVolume = {
      user_role: MASTER_ROLE,
      msg_type: 'audio_command_set_volume',
      volume: Math.max(0, Math.min(2, volume)),
    }
    sendAction(action);
  }, [sendAction]);

  const syncPosition = useCallback((position_sec: number) => {
    const action: AudioCommandSyncPosition = {
      user_role: MASTER_ROLE,
      msg_type: 'audio_command_sync_position',
      position_sec,
    }
    sendAction(action);
  }, [sendAction]);

  const enqueueAudioTrack = useCallback((audioTrackId: string, play = true) => {
    const action: AudioCommandEnqueueTrack = {
      user_role: MASTER_ROLE,
      msg_type: 'audio_command_enqueue_track',
      audio_track_id: audioTrackId,
      play,
    };
    sendAction(action);
  }, [sendAction]);

  const reloadSessionFields = useCallback((fields: string[]) => {
    sendAction({
      user_role: MASTER_ROLE,
      msg_type: 'reload_entities',
      fields,
    } as SessionActionBase);
  }, [sendAction]);

  const toggleLocationHidden = useCallback((locationId: string, hidden: boolean) => {
    const action: MasterToggleLocationHidden = {
      user_role: MASTER_ROLE,
      msg_type: 'toggle_location_hidden',
      location_id: locationId,
      hidden,
    };
    sendAction(action);
  }, [sendAction]);

  const presentEntity = useCallback((
    sceneId: string,
    entityType: 'npc' | 'game_item' | 'player_character' | 'location',
    entityId: string,
    dataAccess: 'none' | 'full' = 'none',
  ) => {
    const action: PresentEntity = {
      user_role: MASTER_ROLE,
      msg_type: 'present_entity',
      scene_id: sceneId,
      entity_type: entityType,
      entity_id: entityId,
      data_access: dataAccess,
    };
    sendAction(action);
  }, [sendAction]);

  const dismissPresentedEntity = useCallback(() => {
    const action: DismissPresentedEntity = {
      user_role: MASTER_ROLE,
      msg_type: 'dismiss_presented_entity',
    };
    sendAction(action);
  }, [sendAction]);

  const grantEntityDataAccess = useCallback((
    sceneId: string,
    entityType: 'npc' | 'game_item' | 'player_character',
    entityId: string,
  ) => {
    const action: GrantEntityDataAccess = {
      user_role: MASTER_ROLE,
      msg_type: 'grant_entity_data_access',
      scene_id: sceneId,
      entity_type: entityType,
      entity_id: entityId,
    };
    sendAction(action);
  }, [sendAction]);

  const revokeEntityDataAccess = useCallback((
    sceneId: string,
    entityType: 'npc' | 'game_item' | 'player_character',
    entityId: string,
  ) => {
    const action: RevokeEntityDataAccess = {
      user_role: MASTER_ROLE,
      msg_type: 'revoke_entity_data_access',
      scene_id: sceneId,
      entity_type: entityType,
      entity_id: entityId,
    };
    sendAction(action);
  }, [sendAction]);

  // Мемоизация результата чтобы не пересоздавать объект на каждый рендер
  return useMemo(() => ({
    connected, selfPlayer,
    session, locations, characters, npcs, items, scenes, notes, counters, logs, actions, observers, settings, polygon_shown,
    audio_queue, audio_player, presentedEntity, dataRevealedEntities, playerSeen,
    isMaster, isPlayer, notifications, dispatches, message_replies, storyBeats, factories, pluginUI, timeline, audio,
    setLocationCheck, addScene, updateScene, delScene, expandScene, collapseScene, moveCharacterToScene, makeNPCDead,
    moveToScene, moveOutScene, mergeScene, setMainScene, setSceneLocation, setSceneTime, setSessionTime, makeElementPublic,
    moveItem, dropItem, takeItem, submitActionStep, patchActionStep, updateSettings, setDefaultSettings,
    masterKickPlayer, masterDeselectPlayerCharacter, masterAssignPlayerCharacter, masterSetPlayerColor,
    showNote, createNote, markDispatchOpened, revokeDispatch, editDispatch, editNote,
    addMessageReply, editMessageReply, deleteMessageReply,
    createObserver, updateObserver, deleteObserver, 
    readNotififcations, createObstacle, updateObstacle, runSceneAction, cancelSceneAction, changeNoteStatus,
    sendRequest, createFactoryObject, applySceneExposure, audioCommand, audioPlayEntry, enqueueAudioTrack, setMasterVolume, syncPosition, toggleLocationHidden,
    reloadSessionFields, presentEntity, dismissPresentedEntity, grantEntityDataAccess, revokeEntityDataAccess,
  }), [
    connected, selfPlayer, session, locations, characters, npcs, items, scenes, observers, settings, polygon_shown,
    audio_queue, audio_player, presentedEntity, dataRevealedEntities, playerSeen,
    notes, counters, logs, actions, isMaster, isPlayer, notifications, dispatches, message_replies, storyBeats, factories, pluginUI, timeline, audio,
    setLocationCheck, addScene, updateScene, delScene, expandScene, collapseScene, moveCharacterToScene, makeNPCDead,
    moveToScene, moveOutScene, mergeScene, setMainScene, setSceneLocation, setSceneTime, setSessionTime, makeElementPublic,
    moveItem, dropItem, takeItem, submitActionStep, patchActionStep, updateSettings, setDefaultSettings,
    masterKickPlayer, masterDeselectPlayerCharacter, masterAssignPlayerCharacter, masterSetPlayerColor,
    showNote, createNote, markDispatchOpened, revokeDispatch, editDispatch, editNote,
    addMessageReply, editMessageReply, deleteMessageReply,
    createObserver, updateObserver, deleteObserver, 
    readNotififcations, createObstacle, updateObstacle, runSceneAction, cancelSceneAction, changeNoteStatus, createFactoryObject, applySceneExposure, toggleLocationHidden,
    audioCommand, audioPlayEntry, enqueueAudioTrack, setMasterVolume, syncPosition, reloadSessionFields,
    presentEntity, dismissPresentedEntity,
  ]);
}
