'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { SessionMessageReply } from '@/app/services/types/sessionMessageReply';
import { Pencil, Trash2 } from 'lucide-react';

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function MessageRepliesPanel({
  noteId,
  replies,
  selfUserId,
  onAdd,
  onEdit,
  onDelete,
}: {
  noteId: string;
  replies: SessionMessageReply[];
  selfUserId: string;
  onAdd: (text: string) => void;
  onEdit: (replyId: string, text: string) => void;
  onDelete: (replyId: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const thread = useMemo(
    () =>
      [...(replies ?? [])]
        .filter((r) => String(r.note_id) === String(noteId) && !r.deleted_at)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [replies, noteId],
  );

  const submitReply = () => {
    const text = draft.trim();
    if (!text) return;
    onAdd(text);
    setDraft('');
  };

  const startEdit = (reply: SessionMessageReply) => {
    setEditingId(reply.id);
    setEditText(reply.text);
  };

  const saveEdit = () => {
    if (!editingId) return;
    const text = editText.trim();
    if (!text) return;
    onEdit(editingId, text);
    setEditingId(null);
    setEditText('');
  };

  return (
    <div className="space-y-3">
      <div className="text-xs text-gray-500 uppercase tracking-wide">Ответы</div>

      {thread.length === 0 ? (
        <div className="text-xs text-gray-500 italic">Пока нет ответов</div>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {thread.map((reply) => {
            const isAuthor = String(reply.author_id) === String(selfUserId);
            const isEditing = editingId === reply.id;

            return (
              <div
                key={reply.id}
                className="rounded-md border border-gray-700 bg-gray-800/80 px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs text-gray-300 font-medium">
                    {reply.author_name ?? (reply.author_role === 'master' ? 'Мастер' : 'Игрок')}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {formatWhen(reply.edited_at ?? reply.created_at)}
                    {reply.edited_at ? ' · изменено' : ''}
                  </span>
                </div>

                {isEditing ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="min-h-[60px] text-sm bg-gray-900 border-gray-600"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveEdit} disabled={!editText.trim()}>
                        Сохранить
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(null);
                          setEditText('');
                        }}
                      >
                        Отмена
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-gray-100 whitespace-pre-wrap break-words">{reply.text}</div>
                    {isAuthor ? (
                      <div className="flex gap-1 mt-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[10px]"
                          onClick={() => startEdit(reply)}
                        >
                          <Pencil className="w-3 h-3 mr-1" />
                          Изменить
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[10px] text-red-400"
                          onClick={() => onDelete(reply.id)}
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Удалить
                        </Button>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Написать ответ..."
          className="min-h-[70px] text-sm bg-gray-800 border-gray-600"
        />
        <Button size="sm" onClick={submitReply} disabled={!draft.trim()}>
          Ответить
        </Button>
      </div>
    </div>
  );
}
