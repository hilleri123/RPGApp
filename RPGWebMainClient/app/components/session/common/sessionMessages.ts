import type { SessionDispatch } from '@/app/services/types/sessionDispatch';
import type { Note } from '@/app/services/types2';
import type { GameSessionBase } from '@/app/services/types/session';

export const KIND_PLOT = 'kind:plot';
export const KIND_DISPATCH = 'kind:dispatch';
export const KIND_TASK = 'kind:task';

export type MessageKind = 'plot' | 'dispatch' | 'task';

export function getMessageKind(d: SessionDispatch): MessageKind {
  const tags = new Set([...(d.tags ?? []), ...(d.note?.tags ?? [])].map(String));
  if (tags.has('task') || tags.has(KIND_TASK)) return 'task';
  if (tags.has(KIND_DISPATCH) || d.sender_role === 'player') return 'dispatch';
  if (tags.has(KIND_PLOT)) return 'plot';
  if (d.sender_role === 'master') return tags.has('task') ? 'task' : 'plot';
  return 'dispatch';
}

export function isRevoked(d: SessionDispatch): boolean {
  return Boolean(d.revoked_at);
}

export function isUnread(d: SessionDispatch, userId?: string | null): boolean {
  if (!userId || isRevoked(d)) return false;
  const uid = String(userId);
  const read = (d.read_by ?? []).map(String);
  if (read.includes(uid)) return false;

  const senderId = String(d.sender_id);
  if (senderId === uid) {
    const editorId = d.edited_by ? String(d.edited_by) : null;
    return Boolean(editorId && editorId !== uid);
  }

  const recipients = (d.recipient_user_ids ?? []).map(String);
  if (recipients.length > 0 && !recipients.includes(uid)) return false;
  return true;
}

export function filterByKind(dispatches: SessionDispatch[], kind: MessageKind): SessionDispatch[] {
  return (dispatches ?? []).filter((d) => !isRevoked(d) && getMessageKind(d) === kind);
}

export function countUnread(dispatches: SessionDispatch[], userId?: string | null, kind?: MessageKind): number {
  const list = kind ? filterByKind(dispatches, kind) : (dispatches ?? []).filter((d) => !isRevoked(d));
  return list.filter((d) => isUnread(d, userId)).length;
}

export const MESSAGE_KIND_LABELS: Record<MessageKind, string> = {
  plot: 'Заметки',
  dispatch: 'Записки',
  task: 'Задания',
};

export function masterDispatchesForNote(
  dispatches: SessionDispatch[],
  noteId: string,
): SessionDispatch[] {
  return (dispatches ?? [])
    .filter(
      (d) =>
        !isRevoked(d) &&
        d.sender_role === 'master' &&
        String(d.note?.id) === String(noteId),
    )
    .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
}

export function latestMasterDispatchForNote(
  dispatches: SessionDispatch[],
  noteId: string,
): SessionDispatch | null {
  return latestDispatchForNote(dispatches, noteId, 'master');
}

export function latestDispatchForNote(
  dispatches: SessionDispatch[],
  noteId: string,
  senderRole?: 'master' | 'player',
): SessionDispatch | null {
  return (dispatches ?? [])
    .filter(
      (d) =>
        !isRevoked(d) &&
        String(d.note?.id) === String(noteId) &&
        (senderRole ? d.sender_role === senderRole : true),
    )
    .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())[0] ?? null;
}

export function getNoteOwnerId(
  note: Pick<Note, 'owner_user_id' | 'id'>,
  session?: Pick<GameSessionBase, 'master'> | null,
): string {
  if (note.owner_user_id) return String(note.owner_user_id);
  return String(session?.master?.id ?? '');
}

export function isNoteOwner(
  note: Pick<Note, 'owner_user_id' | 'id'>,
  userId: string,
  session?: Pick<GameSessionBase, 'master'> | null,
): boolean {
  if (!userId) return false;
  return getNoteOwnerId(note, session) === String(userId);
}

export function canEditDispatch(
  d: SessionDispatch,
  selfUserId: string,
  session?: Pick<GameSessionBase, 'master'> | null,
): boolean {
  if (isRevoked(d) || !d.note) return false;
  return isNoteOwner(d.note, selfUserId, session);
}

export function ownedNotesForKind(
  notes: Note[],
  kind: MessageKind,
  selfUserId?: string,
  session?: Pick<GameSessionBase, 'master'> | null,
): Note[] {
  return (notes ?? []).filter((n) => {
    const tags = new Set((n.tags ?? []).map(String));
    let matches = false;
    if (kind === 'task') matches = tags.has('task') || tags.has(KIND_TASK);
    else if (kind === 'dispatch') matches = tags.has(KIND_DISPATCH);
    else matches = tags.has(KIND_PLOT) && !tags.has(KIND_DISPATCH);
    if (!matches) return false;
    if (selfUserId) return isNoteOwner(n, selfUserId, session);
    return true;
  });
}
