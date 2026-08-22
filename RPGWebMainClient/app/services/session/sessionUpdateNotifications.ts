import { toast } from 'sonner';

import {
  getMessageKind,
  isRevoked,
  isUnread,
  MESSAGE_KIND_LABELS,
} from '@/app/components/session/common/sessionMessages';
import type { GameSession, SessionAction } from '@/app/services/types/session';
import type { SessionDispatch } from '@/app/services/types/sessionDispatch';
import type { SessionMessageReply } from '@/app/services/types/sessionMessageReply';
import type { SessionNotification } from '@/app/services/types/session.notification';
import type { SessionUpdateMessage } from '@/app/services/types/session.ws';
import type { PresentedEntityView } from '@/app/services/types/presentation';
import type { PlayerSeenEntry } from '@/app/services/types/playerSeen';

function truncate(text: string, max = 80): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  return normalized.length > max ? `${normalized.slice(0, max)}…` : normalized;
}

function fieldUpdated(patch: SessionUpdateMessage, field: string): boolean {
  const value = (patch as Record<string, unknown>)[field];
  if (value === undefined) return false;
  if (!Array.isArray(patch.fields)) return true;
  return patch.fields.includes(field);
}

function isNotificationUnread(notif: SessionNotification, userId: string): boolean {
  const read = (notif.readed_by ?? []).map(String);
  return !read.includes(String(userId));
}

function dispatchPreview(d: SessionDispatch): string {
  const note = d.note;
  return truncate(note?.short_desc || note?.name || note?.story || '');
}

function entityTypeLabel(entityType: string): string {
  switch (entityType) {
    case 'npc':
      return 'NPC';
    case 'game_item':
      return 'Предмет';
    case 'player_character':
      return 'Персонаж';
    case 'location':
      return 'Локация';
    default:
      return 'Объект';
  }
}

function entityTitle(entity: { name?: string | null; short_desc?: string | null } | null | undefined): string {
  if (!entity) return '';
  return truncate(entity.name || entity.short_desc || '');
}

function seenEntryKey(entry: PlayerSeenEntry): string {
  return `${entry.entity_type}:${entry.entity_id}:${entry.data_access}`;
}

function notifyNewDispatches(
  prev: SessionDispatch[],
  next: SessionDispatch[],
  userId: string,
  isMaster: boolean,
): void {
  const prevIds = new Set((prev ?? []).map((d) => d.id));

  for (const dispatch of next ?? []) {
    if (prevIds.has(dispatch.id) || isRevoked(dispatch)) continue;
    if (!isUnread(dispatch, userId)) continue;

    const kind = getMessageKind(dispatch);
    const label = MESSAGE_KIND_LABELS[kind].toLowerCase();
    const who = dispatch.sender_name || (dispatch.sender_role === 'master' ? 'Мастер' : 'Игрок');
    const preview = dispatchPreview(dispatch);

    if (isMaster && dispatch.sender_role === 'player') {
      toast.info(`${who}: новая ${label}`, { description: preview || undefined });
      continue;
    }

    if (!isMaster && dispatch.sender_role === 'master') {
      toast.info(`Мастер: ${label}`, { description: preview || undefined });
    }
  }
}

function notifyEditedDispatches(
  prev: SessionDispatch[],
  next: SessionDispatch[],
  userId: string,
  isMaster: boolean,
): void {
  const prevById = new Map((prev ?? []).map((d) => [d.id, d]));

  for (const dispatch of next ?? []) {
    if (isRevoked(dispatch)) continue;

    const old = prevById.get(dispatch.id);
    if (!old || !dispatch.edited_at || dispatch.edited_at === old.edited_at) continue;
    if (String(dispatch.edited_by) === String(userId)) continue;
    if (!isUnread(dispatch, userId)) continue;

    const who = dispatch.sender_name || (dispatch.sender_role === 'master' ? 'Мастер' : 'Игрок');
    const preview = dispatchPreview(dispatch);

    if (isMaster && dispatch.sender_role === 'player') {
      toast.message(`${who} изменил записку`, { description: preview || undefined });
    } else if (!isMaster && dispatch.sender_role === 'master') {
      toast.message(`Мастер изменил ${MESSAGE_KIND_LABELS[getMessageKind(dispatch)].toLowerCase()}`, {
        description: preview || undefined,
      });
    }
  }
}

function notifyNewReplies(
  prev: SessionMessageReply[],
  next: SessionMessageReply[],
  userId: string,
  isMaster: boolean,
): void {
  const prevIds = new Set((prev ?? []).map((r) => r.id));

  for (const reply of next ?? []) {
    if (prevIds.has(reply.id) || reply.deleted_at) continue;
    if (String(reply.author_id) === String(userId)) continue;

    const who = reply.author_name || (reply.author_role === 'master' ? 'Мастер' : 'Игрок');
    const preview = truncate(reply.text);

    if (isMaster && reply.author_role === 'player') {
      toast.message(`${who} ответил`, { description: preview || undefined });
    } else if (!isMaster && reply.author_role === 'master') {
      toast.message('Мастер ответил', { description: preview || undefined });
    }
  }
}

function notifyNewNotifications(
  prev: SessionNotification[],
  next: SessionNotification[],
  userId: string,
  isMaster: boolean,
): void {
  const prevIds = new Set((prev ?? []).map((n) => n.id));

  for (const notif of next ?? []) {
    if (prevIds.has(notif.id)) continue;
    if (!isNotificationUnread(notif, userId)) continue;

    if (notif.notif_type === 'note_shown') {
      if (isMaster) continue;
      const title = notif.note?.name || notif.note?.short_desc || 'Заметка';
      toast.info('Мастер показал заметку', { description: truncate(title) });
      continue;
    }

    if (notif.notif_type === 'action_eval') {
      toast.info(isMaster ? 'Новая оценка действия' : 'Оценка вашего действия');
      continue;
    }

    if (notif.notif_type === 'use_eval') {
      toast.info(isMaster ? 'Новая оценка использования' : 'Оценка использования предмета');
    }
  }
}

function notifyPlayersChange(
  prevPlayers: GameSession['players'],
  nextPlayers: GameSession['players'],
  isMaster: boolean,
): void {
  if (!isMaster) return;

  const prevCount = (prevPlayers ?? []).length;
  const nextCount = (nextPlayers ?? []).length;

  if (nextCount > prevCount) {
    toast.success(`Игрок подключился (${nextCount})`);
  } else if (nextCount < prevCount) {
    toast.message('Игрок отключился', { description: `В сессии: ${nextCount}` });
  }
}

function notifyObserversChange(
  prevObservers: GameSession['observers'],
  nextObservers: GameSession['observers'],
  isMaster: boolean,
): void {
  if (!isMaster) return;

  const prevCount = (prevObservers ?? []).length;
  const nextCount = (nextObservers ?? []).length;

  if (nextCount > prevCount) {
    toast.info('Новый наблюдатель');
  }
}

function notifyPresentedEntity(
  prev: PresentedEntityView | null | undefined,
  next: PresentedEntityView | null | undefined,
  isMaster: boolean,
): void {
  if (isMaster || !next) return;

  const prevId = prev?.presentation_id ?? null;
  const nextId = next.presentation_id ?? null;
  if (!nextId || prevId === nextId) return;

  const label = entityTypeLabel(next.entity_type);
  const title = entityTitle(next.entity as { name?: string | null; short_desc?: string | null });
  toast.info(`Мастер показал: ${label}`, { description: title || undefined });
}

function notifyDataRevealed(
  prev: PlayerSeenEntry[],
  next: PlayerSeenEntry[],
  isMaster: boolean,
): void {
  if (isMaster) return;

  const prevKeys = new Set((prev ?? []).map(seenEntryKey));
  const added = (next ?? []).filter((entry) => !prevKeys.has(seenEntryKey(entry)));
  if (!added.length) return;

  if (added.length === 1) {
    const entry = added[0];
    toast.info('Мастер открыл данные', {
      description: entityTypeLabel(entry.entity_type),
    });
    return;
  }

  toast.info('Мастер открыл новые данные', {
    description: `Объектов: ${added.length}`,
  });
}

function notifyNewPlayerActions(
  prev: SessionAction[],
  next: SessionAction[],
  masterUserId: string | undefined,
  isMaster: boolean,
): void {
  if (!isMaster || !masterUserId) return;

  const prevIds = new Set((prev ?? []).map((action) => action.id));

  for (const action of next ?? []) {
    if (prevIds.has(action.id) || action.status !== 'active') continue;

    const initiatorId = action.participants?.initiatorUserId;
    if (!initiatorId || String(initiatorId) === String(masterUserId)) continue;

    toast.info('Игрок начал действие', {
      description: action.actionKey,
    });
  }
}

export function notifySessionWsUpdate(
  prev: GameSession,
  next: GameSession,
  patch: SessionUpdateMessage,
  userId: string,
): void {
  if (!userId) return;

  const isMaster = patch.role === 'master';
  const prevAny = prev as Record<string, unknown>;
  const nextAny = next as Record<string, unknown>;

  if (fieldUpdated(patch, 'dispatches')) {
    notifyNewDispatches(
      (prevAny.dispatches as SessionDispatch[]) ?? [],
      (nextAny.dispatches as SessionDispatch[]) ?? [],
      userId,
      isMaster,
    );
    notifyEditedDispatches(
      (prevAny.dispatches as SessionDispatch[]) ?? [],
      (nextAny.dispatches as SessionDispatch[]) ?? [],
      userId,
      isMaster,
    );
  }

  if (fieldUpdated(patch, 'message_replies')) {
    notifyNewReplies(
      (prevAny.message_replies as SessionMessageReply[]) ?? [],
      (nextAny.message_replies as SessionMessageReply[]) ?? [],
      userId,
      isMaster,
    );
  }

  if (fieldUpdated(patch, 'notifications')) {
    notifyNewNotifications(
      prev.notifications ?? [],
      next.notifications ?? [],
      userId,
      isMaster,
    );
  }

  if (fieldUpdated(patch, 'players')) {
    notifyPlayersChange(prev.players, next.players, isMaster);
  }

  if (fieldUpdated(patch, 'observers')) {
    notifyObserversChange(prev.observers, next.observers, isMaster);
  }

  if (fieldUpdated(patch, 'presented_entity')) {
    notifyPresentedEntity(
      prevAny.presented_entity as PresentedEntityView | null | undefined,
      nextAny.presented_entity as PresentedEntityView | null | undefined,
      isMaster,
    );
  }

  if (fieldUpdated(patch, 'data_revealed_entities')) {
    notifyDataRevealed(
      (prevAny.data_revealed_entities as PlayerSeenEntry[]) ?? [],
      (nextAny.data_revealed_entities as PlayerSeenEntry[]) ?? [],
      isMaster,
    );
  }

  if (fieldUpdated(patch, 'actions')) {
    notifyNewPlayerActions(
      (prevAny.actions as SessionAction[]) ?? [],
      (nextAny.actions as SessionAction[]) ?? [],
      next.master?.id,
      isMaster,
    );
  }
}
