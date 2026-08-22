'use client';

import { useCallback, useContext, useMemo } from 'react';
import { useSessionWebSocket } from '@/app/services/hooks/useSessionWebSocket';
import { SessionSocketContext, MISSING_SESSION_SOCKET } from '@/app/services/providers/SessionWebSocketProvider';
import type { SessionAction } from '@/app/services/types/session';
import type { Player } from '@/app/services/types/lobby';

function actionVisibleForUser(
  action: SessionAction,
  userId: string,
  showActionToEveryone: boolean | undefined,
): boolean {
  const status = String(action?.status ?? '');
  if (status !== 'active' && status !== 'completed') return false;

  const tags = Array.isArray((action as { tags?: unknown })?.tags)
    ? ((action as { tags?: unknown[] }).tags ?? []).map(String)
    : [];
  const hidden = tags.includes('hidden');
  const participantIds = Array.isArray(action?.participantIds)
    ? action.participantIds.map(String)
    : [];

  // Mirror of backend _enrich_actions_for_user:
  // filter when NOT show_to_everyone OR action is tagged hidden.
  if (!showActionToEveryone || hidden) {
    if (participantIds.length === 0) return true;
    return participantIds.includes(String(userId));
  }
  return true;
}

/**
 * Project master session store into a player-shaped hook result for GM mirror.
 * Always safe to call; returns empty-ish result when playerUserId is null.
 */
export function usePlayerMirrorProjection(sessionId: string, playerUserId: string | null) {
  const master = useSessionWebSocket(sessionId);
  const ctx = useContext(SessionSocketContext);
  const { connected, sendAction, sendRequest, pluginUI } = ctx ?? MISSING_SESSION_SOCKET;

  const selfPlayer: Player | null = useMemo(() => {
    if (!playerUserId) return null;
    const players = master.session?.players ?? [];
    return (
      players.find((p) => String(p.user?.id) === String(playerUserId)) ??
      players.find((p) => String(p.id) === String(playerUserId)) ??
      null
    );
  }, [master.session?.players, playerUserId]);

  const characterId = selfPlayer?.character_id ? String(selfPlayer.character_id) : null;

  const scenes = useMemo(() => {
    const all = Array.isArray(master.scenes) ? master.scenes : [];
    if (!characterId) return [];
    return all.filter((sc) =>
      (sc.characters ?? []).some((ch: { id?: string }) => String(ch.id) === characterId),
    );
  }, [master.scenes, characterId]);

  const scene = useMemo(
    () =>
      scenes.find((sc) =>
        (sc.characters ?? []).some((ch: { id?: string }) => String(ch.id) === characterId),
      ),
    [scenes, characterId],
  );

  const actions = useMemo(() => {
    const raw: SessionAction[] = Array.isArray(master.actions) ? master.actions : [];
    if (!playerUserId) return [];
    const showEveryone = Boolean((master.settings as any)?.show_action_to_everyone);
    return raw.filter((a) => actionVisibleForUser(a, playerUserId, showEveryone));
  }, [master.actions, master.settings, playerUserId]);

  const noopAction = useCallback((_action?: unknown) => {
    /* mirror: blocked at SessionWebSocketProvider */
  }, []);

  const noopRequest = useCallback(async <T,>(): Promise<T> => {
    throw new Error('Player mirror is read-only');
  }, []);

  return useMemo(
    () => ({
      connected,
      selfPlayer,
      session: master.session,
      locations: master.locations,
      characters: master.characters,
      npcs: master.npcs,
      items: master.items,
      scene,
      scenes,
      notes: master.notes,
      message_replies: master.message_replies,
      logs: master.logs,
      polygon_shown: master.polygon_shown,
      isPlayer: true,
      notifications: master.notifications,
      dispatches: master.dispatches,
      actions,
      settings: master.settings,
      audio_queue: master.audio_queue,
      audio_player: master.audio_player,
      pluginUI: pluginUI ?? master.pluginUI ?? null,
      playerSeen: master.playerSeen,
      presentedEntity: master.presentedEntity,
      takeItem: noopAction as any,
      dropItem: noopAction as any,
      runSceneAction: noopAction as any,
      changeNoteStatus: noopAction as any,
      dispatchNote: noopAction as any,
      markDispatchOpened: noopAction as any,
      editDispatch: noopAction as any,
      editNote: noopAction as any,
      playerCreateNote: noopAction as any,
      publishNote: noopAction as any,
      addMessageReply: noopAction as any,
      editMessageReply: noopAction as any,
      deleteMessageReply: noopAction as any,
      readNotififcations: noopAction as any,
      sendRequest: noopRequest as typeof sendRequest,
      submitActionStep: noopAction as any,
      patchActionStep: noopAction as any,
      cancelSceneAction: noopAction as any,
      listReplaceCharacterOptions: async () => [],
      replaceCharacter: noopAction as any,
    }),
    [
      connected,
      selfPlayer,
      master.session,
      master.locations,
      master.characters,
      master.npcs,
      master.items,
      scene,
      scenes,
      master.notes,
      master.message_replies,
      master.logs,
      master.polygon_shown,
      master.notifications,
      master.dispatches,
      actions,
      master.settings,
      master.audio_queue,
      master.audio_player,
      pluginUI,
      master.pluginUI,
      master.presentedEntity,
      noopAction,
      noopRequest,
      sendRequest,
    ],
  );
}
