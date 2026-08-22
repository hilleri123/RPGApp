'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BaseFeedRow } from '@/app/components/common/BaseFeedRow';
import { useCommonSessionWebSocket } from '@/app/services/hooks/useCommonSessionWebSocket';
import { useSessionWebSocket } from '@/app/services/hooks/useSessionWebSocket';
import { usePlayerSessionWebSocket } from '@/app/services/hooks/usePlayerSessionWebSocket';
import type { SessionDispatch } from '@/app/services/types/sessionDispatch';
import type { Note } from '@/app/services/types2';
import { NoteShownModal } from '../notifications/NoteShownModal';
import type { NoteShownNotification } from '@/app/services/types/session.notification';
import { filterSessionNotes } from '@/app/components/masterNotes/constants';
import SessionNoteShowDialog from '@/app/components/session/masterView/note/SessionNoteShowDialog';
import SessionNoteCreateDialog from '@/app/components/session/masterView/control/dialogs/SessionNoteCreateDialog';
import SessionNoteEditDialog from '@/app/components/session/masterView/control/dialogs/SessionNoteEditDialog';
import { SessionDispatchEditDialog } from './SessionDispatchEditDialog';
import type { NoteCreate } from '@/app/services/types2';
import {
  countUnread,
  filterByKind,
  getMessageKind,
  isRevoked,
  isUnread,
  latestDispatchForNote,
  MESSAGE_KIND_LABELS,
  canEditDispatch,
  ownedNotesForKind,
  type MessageKind,
} from '../sessionMessages';
import { Circle, Eye, Mail, ScrollText, ClipboardList, Undo2, Pencil } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const PLAYER_TAG_PRESETS = ['действие', 'вопрос', 'заметка'];

function dispatchToNotif(d: SessionDispatch): NoteShownNotification {
  return {
    id: d.id,
    dt: d.sent_at,
    notif_type: 'note_shown',
    initiator_id: d.sender_id,
    recipients: d.recipient_user_ids,
    readed_by: d.read_by ?? [],
    note: d.note,
  };
}

function ReadReceipts({
  dispatch,
  players,
}: {
  dispatch: SessionDispatch;
  players: { user?: { id?: string }; name?: string; color?: string }[];
}) {
  const readSet = new Set((dispatch.read_by ?? []).map(String));
  const recipients = dispatch.recipient_user_ids ?? [];
  if (!recipients.length) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {recipients.map((uid) => {
        const p = players.find((x) => String(x.user?.id) === String(uid));
        const opened = readSet.has(String(uid));
        return (
          <span
            key={uid}
            title={opened ? 'Открыто' : 'Не открыто'}
            className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border ${
              opened
                ? 'border-green-500/40 bg-green-500/10 text-green-300'
                : 'border-gray-600 bg-gray-800/80 text-gray-500'
            }`}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: p?.color ?? '#888' }}
            />
            {p?.name ?? uid.slice(0, 6)}
            {opened ? <Eye className="w-2.5 h-2.5" /> : <Circle className="w-2.5 h-2.5" />}
          </span>
        );
      })}
    </div>
  );
}

function MasterNoteRow({
  note,
  dispatch,
  players,
  onEdit,
  onShow,
  onOpen,
  onRevoke,
}: {
  note: Note;
  dispatch: SessionDispatch | null;
  players: any[];
  onEdit: () => void;
  onShow: () => void;
  onOpen?: () => void;
  onRevoke?: () => void;
}) {
  const shown = Boolean(dispatch);

  return (
    <div
      className={`rounded border px-2 py-1.5 flex flex-col gap-1.5 ${
        shown ? 'border-indigo-500/40 bg-indigo-500/5' : 'border-gray-700 bg-gray-900/60'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-white truncate">{note.name}</span>
        {shown ? (
          <Badge variant="outline" className="text-[10px] text-indigo-300 border-indigo-500/40 shrink-0">
            показано
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] text-gray-400 border-gray-600 shrink-0">
            не показано
          </Badge>
        )}
      </div>
      {shown && dispatch ? <ReadReceipts dispatch={dispatch} players={players} /> : null}
      <div className="flex flex-wrap gap-1">
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onEdit}>
          <Pencil className="w-3 h-3 mr-1" />
          Изменить
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onShow}>
          Показать
        </Button>
        {shown && onOpen ? (
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onOpen}>
            Открыть
          </Button>
        ) : null}
        {shown && onRevoke ? (
          <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400" onClick={onRevoke}>
            <Undo2 className="w-3 h-3 mr-1" />
            Отозвать
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function DispatchRow({
  d,
  isMaster,
  selfUserId,
  session,
  players,
  onOpen,
  onEdit,
  onRevoke,
}: {
  d: SessionDispatch;
  isMaster: boolean;
  selfUserId: string;
  session: any;
  players: any[];
  onOpen: () => void;
  onEdit?: () => void;
  onRevoke?: () => void;
}) {
  const revoked = isRevoked(d);
  const isSent = isMaster && d.sender_role === 'master';
  const updated = Boolean(d.edited_at);

  return (
    <BaseFeedRow id={d.id} dt={d.sent_at}>
      <div
        className={`rounded px-2 py-1.5 border-l-2 ${
          revoked
            ? 'border-red-500/40 bg-red-500/5 opacity-60'
            : isSent
              ? 'border-indigo-500/40 bg-indigo-500/5'
              : 'border-violet-500/40 hover:bg-gray-800/80'
        }`}
      >
        <button type="button" className="w-full text-left" onClick={onOpen}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-white">{d.note?.name ?? 'Сообщение'}</span>
            {revoked ? (
              <Badge variant="outline" className="text-[10px] text-red-300 border-red-500/40">
                отозвано
              </Badge>
            ) : isSent ? (
              <Badge variant="outline" className="text-[10px] text-indigo-300 border-indigo-500/40">
                отправлено
              </Badge>
            ) : updated ? (
              <Badge variant="outline" className="text-[10px] text-amber-300 border-amber-500/40">
                обновлено
              </Badge>
            ) : null}
            <span className="text-[10px] text-gray-500">{d.sender_name ?? d.sender_role}</span>
          </div>
        </button>
        {isMaster ? <ReadReceipts dispatch={d} players={players} /> : null}
        <div className="flex flex-wrap gap-1 mt-1">
          {!isRevoked(d) && onEdit && canEditDispatch(d, selfUserId, session) ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[10px] text-gray-300"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <Pencil className="w-3 h-3 mr-1" />
              Изменить
            </Button>
          ) : null}
          {!revoked && onRevoke && String(d.sender_id) === selfUserId ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[10px] text-red-400"
              onClick={onRevoke}
            >
              <Undo2 className="w-3 h-3 mr-1" />
              Отозвать
            </Button>
          ) : null}
        </div>
      </div>
    </BaseFeedRow>
  );
}

export function SessionMessagesPanel({
  sessionId,
  variant,
}: {
  sessionId: string;
  variant: 'master' | 'player';
}) {
  const common = useCommonSessionWebSocket(sessionId) as any;
  const master = useSessionWebSocket(sessionId);
  const player = usePlayerSessionWebSocket(sessionId);

  const isMaster = variant === 'master';
  const {
    dispatches,
    message_replies,
    session,
    selfUserId,
    markDispatchOpened,
    revokeDispatch,
    editNote,
    addMessageReply,
    editMessageReply,
    deleteMessageReply,
  } = common;
  const notes = (isMaster ? master.notes : player.notes) as Note[];
  const players = session?.players ?? [];

  const showNote = isMaster ? master.showNote : player.publishNote;
  const createNote = isMaster ? master.createNote : undefined;
  const playerCreateNote = !isMaster ? player.playerCreateNote : undefined;

  const [kindTab, setKindTab] = useState<MessageKind>('plot');
  const [active, setActive] = useState<SessionDispatch | null>(null);
  const [showModalOpen, setShowModalOpen] = useState(false);
  const [noteToShow, setNoteToShow] = useState<Note | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editNoteId, setEditNoteId] = useState<string | null>(null);
  const [editDispatchTarget, setEditDispatchTarget] = useState<SessionDispatch | null>(null);
  const [editOwnedNote, setEditOwnedNote] = useState<Note | null>(null);
  const [dispatchCreateOpen, setDispatchCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createText, setCreateText] = useState('');
  const [createTags, setCreateTags] = useState('');
  const autoOpenedRef = useRef<Set<string>>(new Set());

  const dispatchesForKind = useCallback(
    (k: MessageKind) =>
      [...filterByKind(dispatches, k)].sort(
        (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime(),
      ),
    [dispatches],
  );

  const notesForKind = useCallback(
    (k: MessageKind) => {
      if (k === 'dispatch') {
        return ownedNotesForKind(notes, k, selfUserId, session);
      }
      if (!isMaster) return [];
      if (k === 'task') {
        return notes.filter((n) => Array.isArray(n.tags) && n.tags.includes('task'));
      }
      return filterSessionNotes(notes);
    },
    [isMaster, notes, selfUserId, session],
  );

  const unreadPlot = countUnread(dispatches, selfUserId, 'plot');
  const unreadDispatch = countUnread(dispatches, selfUserId, 'dispatch');
  const unreadTask = countUnread(dispatches, selfUserId, 'task');

  const openDispatch = useCallback(
    (d: SessionDispatch) => {
      setActive(d);
      if (isUnread(d, selfUserId)) {
        markDispatchOpened(d.id);
      }
    },
    [selfUserId, markDispatchOpened],
  );

  useEffect(() => {
    if (!active) return;
    const fresh = dispatches.find((d) => d.id === active.id);
    if (fresh && fresh !== active) {
      setActive(fresh);
    }
  }, [dispatches, active]);

  useEffect(() => {
    if (isMaster || !selfUserId) return;
    for (const d of dispatches) {
      if (isUnread(d, selfUserId) && !isRevoked(d)) {
        autoOpenedRef.current.delete(d.id);
      }
    }
  }, [dispatches, isMaster, selfUserId]);

  useEffect(() => {
    if (isMaster || !selfUserId) return;
    const unread = dispatches.filter((d) => isUnread(d, selfUserId) && !isRevoked(d));
    if (!unread.length) return;
    const latest = [...unread].sort(
      (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime(),
    )[0];
    if (autoOpenedRef.current.has(latest.id)) return;
    autoOpenedRef.current.add(latest.id);
    setKindTab(getMessageKind(latest));
    openDispatch(latest);
  }, [dispatches, isMaster, selfUserId, openDispatch]);

  const availableCharacters = (master.characters ?? []).filter((c) =>
    players.some((p: { character_id?: string | null }) => p.character_id === c.id),
  );

  const playerShowCharacters = useMemo(() => {
    const selfCharId = player.selfPlayer?.character_id
      ? String(player.selfPlayer.character_id)
      : null;
    return availableCharacters.filter((c) => !selfCharId || c.id !== selfCharId);
  }, [availableCharacters, player.selfPlayer?.character_id]);

  const createDispatchDraft = () => {
    const tagList = createTags.split(',').map((t) => t.trim()).filter(Boolean);
    if (!createName.trim() || tagList.length === 0) return;
    const payload = {
      name: createName.trim(),
      text: createText || null,
      tags: tagList,
    };
    if (isMaster && createNote) {
      createNote({ ...payload, tags: [...tagList, 'kind:dispatch'] });
    } else if (playerCreateNote) {
      playerCreateNote(payload);
    } else {
      return;
    }
    setCreateName('');
    setCreateText('');
    setCreateTags('');
    setDispatchCreateOpen(false);
  };

  const kindIcon = (k: MessageKind) => {
    if (k === 'plot') return <ScrollText className="w-3.5 h-3.5" />;
    if (k === 'task') return <ClipboardList className="w-3.5 h-3.5" />;
    return <Mail className="w-3.5 h-3.5" />;
  };

  const unreadFor = (k: MessageKind) =>
    k === 'plot' ? unreadPlot : k === 'dispatch' ? unreadDispatch : unreadTask;

  const renderOwnedNotes = (sessionNotes: Note[]) => (
    <div className="space-y-1.5">
      {sessionNotes.length === 0 ? (
        <div className="text-xs text-gray-500 italic px-1 py-2">Пока пусто</div>
      ) : (
        sessionNotes.map((n) => {
          const dispatch = latestDispatchForNote(dispatches, n.id);
          return (
            <MasterNoteRow
              key={n.id}
              note={n}
              dispatch={dispatch}
              players={players}
              onEdit={() => (dispatch ? setEditDispatchTarget(dispatch) : setEditOwnedNote(n))}
              onShow={() => {
                setNoteToShow(n);
                setShowModalOpen(true);
              }}
              onOpen={dispatch ? () => openDispatch(dispatch) : undefined}
              onRevoke={
                dispatch && revokeDispatch && String(dispatch.sender_id) === selfUserId
                  ? () => revokeDispatch(dispatch.id)
                  : undefined
              }
            />
          );
        })
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full min-h-0 gap-2">
      <Tabs
        value={kindTab}
        onValueChange={(v) => setKindTab(v as MessageKind)}
        className="flex flex-col min-h-0 flex-1"
      >
        <TabsList className="shrink-0">
          {(['plot', 'dispatch', 'task'] as MessageKind[]).map((k) => (
            <TabsTrigger key={k} value={k} className="text-xs gap-1">
              {kindIcon(k)}
              {MESSAGE_KIND_LABELS[k]}
              {unreadFor(k) > 0 ? (
                <span className="ml-0.5 text-[10px] bg-violet-700 rounded-full px-1 py-0 leading-none">
                  {unreadFor(k)}
                </span>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>

        {(['plot', 'dispatch', 'task'] as MessageKind[]).map((k) => {
          const sessionNotes = notesForKind(k);
          const noteIds = new Set(sessionNotes.map((n) => n.id));
          const kindDispatches = dispatchesForKind(k).filter((d) => {
            if (k === 'dispatch') {
              return String(d.sender_id) !== selfUserId || !noteIds.has(String(d.note?.id));
            }
            if (!isMaster) return true;
            return d.sender_role !== 'master' || !noteIds.has(String(d.note?.id));
          });

          return (
          <TabsContent key={k} value={k} className="flex-1 min-h-0 overflow-y-auto mt-2 space-y-2">
            {isMaster && k === 'plot' ? (
              <Button size="sm" variant="outline" className="w-full" onClick={() => setCreateOpen(true)}>
                + Новая заметка
              </Button>
            ) : null}

            {isMaster && k === 'task' ? (
              <Button size="sm" variant="outline" className="w-full" onClick={() => setCreateOpen(true)}>
                + Новое задание
              </Button>
            ) : null}

            {k === 'dispatch' ? (
              <Button size="sm" variant="outline" className="w-full" onClick={() => setDispatchCreateOpen(true)}>
                + Новая записка
              </Button>
            ) : null}

            {(isMaster && k !== 'dispatch') || k === 'dispatch' ? renderOwnedNotes(sessionNotes) : null}

            {(k === 'dispatch' || !isMaster) && (
            <div className="space-y-1">
              {kindDispatches.length === 0 && (isMaster ? k === 'dispatch' : k !== 'dispatch' && sessionNotes.length === 0) ? (
                <div className="text-xs text-gray-500 italic px-1 py-2">Пока пусто</div>
              ) : (
                kindDispatches.map((d) => (
                  <DispatchRow
                    key={d.id}
                    d={d}
                    isMaster={isMaster}
                    selfUserId={selfUserId}
                    session={session}
                    players={players}
                    onOpen={() => openDispatch(d)}
                    onEdit={canEditDispatch(d, selfUserId, session) ? () => setEditDispatchTarget(d) : undefined}
                    onRevoke={revokeDispatch ? () => revokeDispatch(d.id) : undefined}
                  />
                ))
              )}
            </div>
            )}
          </TabsContent>
          );
        })}
      </Tabs>

      {active ? (
        <NoteShownModal
          open
          onClose={() => setActive(null)}
          notif={dispatchToNotif(active)}
          sessionId={sessionId}
          initiatorName={active.sender_name ?? ''}
          selfUserId={selfUserId}
          messageReplies={message_replies ?? []}
          onAddReply={(text) => addMessageReply?.(String(active.note.id), text)}
          onEditReply={(replyId, text) => editMessageReply?.(replyId, text)}
          onDeleteReply={(replyId) => deleteMessageReply?.(replyId)}
        />
      ) : null}

      {showNote ? (
        <SessionNoteShowDialog
          open={showModalOpen}
          onClose={() => {
            setShowModalOpen(false);
            setNoteToShow(null);
          }}
          note={noteToShow}
          characters={isMaster ? availableCharacters : playerShowCharacters}
          showMasterOption={!isMaster}
          defaultIncludeMaster
          onShow={async (noteId, ids, includeMaster) => {
            if (isMaster) {
              showNote(noteId, ids);
            } else {
              showNote(noteId, ids, includeMaster ?? true);
            }
            setShowModalOpen(false);
          }}
        />
      ) : null}

      {isMaster ? (
        <>
          <SessionNoteCreateDialog open={createOpen} onClose={() => setCreateOpen(false)} />
          <SessionNoteEditDialog
            open={!!editNoteId}
            noteId={editNoteId}
            onClose={() => setEditNoteId(null)}
          />
        </>
      ) : null}

      <Dialog open={dispatchCreateOpen} onOpenChange={(v) => !v && setDispatchCreateOpen(false)}>
        <DialogContent className="bg-gray-900 text-white border-gray-700 max-w-lg">
          <DialogHeader>
            <DialogTitle>Новая записка</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Заголовок"
              className="bg-gray-800 border-gray-600"
            />
            <Textarea
              value={createText}
              onChange={(e) => setCreateText(e.target.value)}
              placeholder="Текст"
              className="min-h-[80px] bg-gray-800 border-gray-600"
            />
            <Input
              value={createTags}
              onChange={(e) => setCreateTags(e.target.value)}
              placeholder="Теги через запятую"
              className="bg-gray-800 border-gray-600"
            />
            <div className="flex flex-wrap gap-1">
              {PLAYER_TAG_PRESETS.map((t) => (
                <Button
                  key={t}
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px]"
                  onClick={() => setCreateTags((prev) => (prev ? `${prev}, ${t}` : t))}
                >
                  +{t}
                </Button>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              Сначала создаётся черновик. Показать его можно кнопкой «Показать» в списке ниже.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDispatchCreateOpen(false)}>
              Отмена
            </Button>
            <Button onClick={createDispatchDraft} disabled={!createName.trim() || !createTags.trim()}>
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SessionDispatchEditDialog
        open={!!editDispatchTarget || !!editOwnedNote}
        dispatch={editDispatchTarget}
        note={editOwnedNote}
        onClose={() => {
          setEditDispatchTarget(null);
          setEditOwnedNote(null);
        }}
        onSave={(noteId, note: NoteCreate) => {
          editNote?.(noteId, note);
        }}
      />
    </div>
  );
}
