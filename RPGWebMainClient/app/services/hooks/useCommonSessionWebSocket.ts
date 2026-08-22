'use client';

import { useSessionWebSocket } from '@/app/services/hooks/useSessionWebSocket';
import { usePlayerSessionWebSocket } from '@/app/services/hooks/usePlayerSessionWebSocket';
import type { SessionMessageReply } from '@/app/services/types/sessionMessageReply';
import type { NoteCreate } from '@/app/services/types2';
import { usePlayerMirrorContext } from '@/app/components/session/masterView/playerMirror/PlayerMirrorContext';

export interface CommonSessionWebSocketResult {
  // базовое
  isMaster: boolean;
  selfPlayer?: import('../types/lobby').Player | null;
  selfUserId: string;
  session: import('@/app/services/types/session').GameSessionBase | undefined;
  scenes: import('@/app/services/types/session').Scene[];

  // сущности
  characters: import('../types2').PlayerCharacter[];
  npcs: import('../types2').NPC[];
  items: import('../types2').GameItem[];
  locations: import('../types2').Location[];

  // логи, формулы, нотификации
  actions: import('@/app/services/types/session').SessionAction[];
  dispatches: import('../types/sessionDispatch').SessionDispatch[];
  message_replies: SessionMessageReply[];
  logs: import('../types/logmsg').LogMsg[];
  notifications: import('../types/session.notification').SessionNotification[];
  audio_queue: import('../types/audio').AudioQueueEntry[];

  pluginUI: import('@/app/plugins/pluginTypes').PluginUI | null;

  // методы
  changeNoteStatus: (note_id: string, status: null | 'pending' | 'completed') => void;
  markDispatchOpened: (dispatch_id: string) => void;
  editNote: (note_id: string, note: NoteCreate) => void;
  editDispatch: (dispatch_id: string, note: NoteCreate) => void;
  addMessageReply: (note_id: string, text: string) => void;
  editMessageReply: (reply_id: string, text: string) => void;
  deleteMessageReply: (reply_id: string) => void;
  revokeDispatch?: (dispatch_id: string) => void;
  readNotififcations: (ids: string[]) => void;
  submitActionStep: (actionId: string, input: Record<string, any>) => void;
  patchActionStep?: (actionId: string, input: Record<string, any>) => void;
  cancelSceneAction?: (actionId: string) => void;
}

export function useCommonSessionWebSocket(sessionId: string): CommonSessionWebSocketResult {
  const mirror = usePlayerMirrorContext();
  const masterData = useSessionWebSocket(sessionId);
  const playerData = usePlayerSessionWebSocket(sessionId);

  // GM player-eyes mirror: expose projected player surface (commands already no-op).
  if (mirror?.enabled) {
    const selfUserId = String(mirror.playerUserId);
    return {
      isMaster: false,
      selfPlayer: playerData.selfPlayer,
      selfUserId,
      session: playerData.session,
      scenes: playerData.scenes ?? [],
      characters: playerData.characters ?? [],
      npcs: playerData.npcs ?? [],
      items: playerData.items ?? [],
      locations: playerData.locations ?? [],
      logs: playerData.logs ?? [],
      actions: playerData.actions ?? [],
      dispatches: playerData.dispatches ?? [],
      message_replies: playerData.message_replies ?? [],
      notifications: playerData.notifications ?? [],
      audio_queue: [],
      pluginUI: playerData.pluginUI ?? null,
      readNotififcations: playerData.readNotififcations,
      submitActionStep: playerData.submitActionStep,
      patchActionStep: playerData.patchActionStep,
      cancelSceneAction: playerData.cancelSceneAction,
      changeNoteStatus: playerData.changeNoteStatus,
      markDispatchOpened: playerData.markDispatchOpened,
      editDispatch: playerData.editDispatch,
      editNote: playerData.editNote,
      addMessageReply: playerData.addMessageReply,
      editMessageReply: playerData.editMessageReply,
      deleteMessageReply: playerData.deleteMessageReply,
    };
  }

  if (!masterData.isMaster && playerData.selfPlayer) {
    const selfUserId = String(playerData.selfPlayer?.user?.id ?? '');
    return {
      isMaster: false,
      selfPlayer: playerData.selfPlayer,
      selfUserId,
      session: playerData.session,
      scenes: playerData.scenes,
      characters: playerData.characters ?? [],
      npcs: playerData.npcs ?? [],
      items: playerData.items ?? [],
      locations: playerData.locations ?? [],
      logs: playerData.logs ?? [],
      actions: playerData.actions ?? [],
      dispatches: playerData.dispatches ?? [],
      message_replies: playerData.message_replies ?? [],
      notifications: playerData.notifications ?? [],
      audio_queue: [],
      pluginUI: playerData.pluginUI ?? null,
      readNotififcations: playerData.readNotififcations,
      submitActionStep: playerData.submitActionStep,
      patchActionStep: playerData.patchActionStep,
      cancelSceneAction: playerData.cancelSceneAction,
      changeNoteStatus: playerData.changeNoteStatus,
      markDispatchOpened: playerData.markDispatchOpened,
      editDispatch: playerData.editDispatch,
      editNote: playerData.editNote,
      addMessageReply: playerData.addMessageReply,
      editMessageReply: playerData.editMessageReply,
      deleteMessageReply: playerData.deleteMessageReply,
    };
  }

  const selfUserId = String(masterData.session?.master?.id ?? masterData.selfPlayer?.user?.id ?? '');

  return {
    isMaster: !!masterData.isMaster,
    selfPlayer: masterData.selfPlayer,
    selfUserId,
    session: masterData.session,
    scenes: masterData.scenes,
    characters: masterData.characters ?? [],
    npcs: masterData.npcs ?? [],
    items: masterData.items ?? [],
    locations: masterData.locations ?? [],
    logs: masterData.logs ?? [],
    actions: masterData.actions ?? [],
    dispatches: masterData.dispatches ?? [],
    message_replies: masterData.message_replies ?? [],
    notifications: masterData.notifications ?? [],
    audio_queue: masterData.audio_queue ?? [],
    pluginUI: masterData.pluginUI ?? null,
    readNotififcations: masterData.readNotififcations,
    submitActionStep: masterData.submitActionStep,
    patchActionStep: masterData.patchActionStep,
    cancelSceneAction: masterData.cancelSceneAction,
    changeNoteStatus: masterData.changeNoteStatus,
    markDispatchOpened: masterData.markDispatchOpened,
    editDispatch: masterData.editDispatch,
    editNote: masterData.editNote,
    addMessageReply: masterData.addMessageReply,
    editMessageReply: masterData.editMessageReply,
    deleteMessageReply: masterData.deleteMessageReply,
    revokeDispatch: masterData.revokeDispatch,
  };
}
