// components/session/NoteShownModal.tsx
"use client";

import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { GameSessionBase } from "@/app/services/types/session";
import { NoteShownNotification } from "@/app/services/types/session.notification";
import { useCommonSessionWebSocket } from "@/app/services/hooks/useCommonSessionWebSocket";
import { CheckCircle, Clock, RotateCcw, Eye, EyeOff, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";

import { MessageRepliesPanel } from './MessageRepliesPanel';

interface NoteShownModalProps {
  open: boolean;
  onClose: () => void;
  notif: NoteShownNotification;
  initiatorName: string;
  sessionId: string;
  selfUserId?: string;
  messageReplies?: import('@/app/services/types/sessionMessageReply').SessionMessageReply[];
  onAddReply?: (text: string) => void;
  onEditReply?: (replyId: string, text: string) => void;
  onDeleteReply?: (replyId: string) => void;
}

const FALLBACK_IMG = "https://rpgzona.ru/static/img/note-default.png";
const FALLBACK_ICON = "https://rpgzona.ru/static/img/icon-default.png";

export function NoteShownModal({
  open,
  onClose,
  notif,
  initiatorName,
  sessionId,
  selfUserId = '',
  messageReplies = [],
  onAddReply,
  onEditReply,
  onDeleteReply,
}: NoteShownModalProps) {
  const { isMaster, session, notifications, changeNoteStatus } = useCommonSessionWebSocket(sessionId);
  const liveNotif = useMemo(
    () => (notifications.find((n) => n.id === notif.id) as NoteShownNotification | undefined) ?? notif,
    [notifications, notif.id]
  );

  const note = liveNotif.note;
  const tags: string[] = Array.isArray(note.tags) ? note.tags.map(String) : [];
  // console.info(`TAGS ${tags} ${note}`)
  // console.info(note)
  const status: "pending" | "completed" | null = tags.includes("completed")
    ? "completed"
    : tags.includes("pending")
    ? "pending"
    : null;

  const isForAll =
    !note.allowed_character_shown_json ||
    note.allowed_character_shown_json.length === 0;

  const [showBody, setShowBody] = useState(isForAll);
  const [loadingStatus, setLoadingStatus] = useState(false);

  // character_id → { name, color }
  const charMap = useMemo(() => {
    const map: Record<string, { name: string; color: string }> = {};
    for (const p of session?.players ?? []) {
      if (p.character_id) {
        map[p.character_id] = {
          name: p.character?.name ?? p.name,
          color: p.color ?? "#ffffff",
        };
      }
    }
    return map;
  }, [session]);

  const shownChars = useMemo(() => {
    return (note.character_shown ?? []).map((cid) => ({
      id: cid,
      name: charMap[cid]?.name ?? cid,
      color: charMap[cid]?.color ?? "#888",
    }));
  }, [note.character_shown, charMap]);

  const handleStatus = async (next: null | "pending" | "completed") => {
    setLoadingStatus(true);
    try {
      changeNoteStatus(note.id, next);
    } finally {
      setLoadingStatus(false);
    }
  };

  const imgSrc = note.img_url || FALLBACK_IMG;
  const iconSrc = note.icon_url || FALLBACK_ICON;

  const StatusBadge = () => {
    if (status === "pending")
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">
          <Clock className="w-3 h-3" /> В процессе
        </span>
      );
    if (status === "completed")
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 border border-green-500/40">
          <CheckCircle className="w-3 h-3" /> Выполнено
        </span>
      );
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogTitle className="sr-only">
        {note.name || "Заметка"}
      </DialogTitle>
      <DialogContent className="bg-gray-900 text-white max-w-lg p-0 overflow-hidden">
        {/* Шапка с картинкой */}
        <div className="relative h-36">
          <img
            src={imgSrc}
            alt=""
            className="w-full h-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent" />

          {/* Иконка + название */}
          <div className="absolute left-4 bottom-3 flex items-end gap-3">
            <img
              src={iconSrc}
              alt=""
              className="w-12 h-12 rounded-md border border-gray-600 bg-gray-800 object-cover shrink-0"
            />
            <div>
              <div className="text-base font-semibold text-white leading-tight">
                {note.name || "Безымянная заметка"}
              </div>
              {tags.includes("task") && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs text-gray-400">Задание</span>
                  <StatusBadge />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Кому показано */}
          <div>
            <div className="text-xs text-gray-500 mb-1.5 uppercase tracking-wide">
              {isForAll ? "Показано всем" : "Показано персонажам"}
            </div>
            {shownChars.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {shownChars.map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-gray-800 border border-gray-700 text-gray-200"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/20"
                      style={{ background: c.color }}
                    />
                    {c.name}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-gray-500 italic">
                Нет данных о получателях
              </span>
            )}
          </div>

          {/* Текст заметки */}
          <div>
            <div className="text-xs text-gray-500 mb-1.5 uppercase tracking-wide">
              Содержание
            </div>
            {!showBody ? (
              <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 flex items-center justify-between gap-3">
                <span className="text-xs text-yellow-300">
                  Секретно — для персонального просмотра
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => setShowBody(true)}
                >
                  <Eye className="w-3.5 h-3.5 mr-1" /> Показать
                </Button>
              </div>
            ) : (
              <div className="rounded-md bg-gray-800 border border-gray-700 p-3 max-h-48 overflow-y-auto">
                {note.text ? (
                  <div
                    className="prose prose-invert prose-sm max-w-none text-sm"
                    dangerouslySetInnerHTML={{ __html: note.text }}
                  />
                ) : (
                  <span className="text-xs text-gray-500 italic">
                    Текст не указан
                  </span>
                )}
                {!isForAll && (
                  <button
                    type="button"
                    className="mt-2 text-xs text-gray-500 flex items-center gap-1 hover:text-gray-300"
                    onClick={() => setShowBody(false)}
                  >
                    <EyeOff className="w-3 h-3" /> Скрыть
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Управление статусом (только для task-заметок) */}
          {tags.includes("task") && (
            <div>
              <div className="text-xs text-gray-500 mb-1.5 uppercase tracking-wide">
                Статус задания
              </div>

              {/* Текущий статус — визуальный индикатор */}
              <div className="flex items-center gap-2 mb-2">
                {status === null && (
                  <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-gray-700 text-gray-300 border border-gray-600">
                    <Circle className="w-3 h-3" /> Новое
                  </span>
                )}
                {status === "pending" && (
                  <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">
                    <Clock className="w-3 h-3" /> В процессе
                  </span>
                )}
                {status === "completed" && (
                  <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-green-500/20 text-green-300 border border-green-500/40">
                    <CheckCircle className="w-3 h-3" /> Выполнено
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {/* Игрок */}
                {!isMaster && status !== "completed" && (
                  <>
                    {status !== "pending" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loadingStatus}
                        onClick={() => handleStatus("pending")}
                      >
                        <Clock className="w-3.5 h-3.5 mr-1 text-yellow-400" />
                        Взять в работу
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loadingStatus}
                        onClick={() => handleStatus(null)}
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1 text-gray-400" />
                        Отменить
                      </Button>
                    )}
                  </>
                )}

                {/* Мастер */}
                {isMaster && (
                  <>
                    {status === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loadingStatus}
                        onClick={() => handleStatus(null)}
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1 text-gray-400" />
                        Отменить выполнение
                      </Button>
                    )}
                    {status !== "completed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loadingStatus}
                        onClick={() => handleStatus("completed")}
                      >
                        <CheckCircle className="w-3.5 h-3.5 mr-1 text-green-400" />
                        Отметить выполненным
                      </Button>
                    )}
                    {status === "completed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loadingStatus}
                        onClick={() => handleStatus(null)}
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1 text-gray-400" />
                        Сбросить статус
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {onAddReply && onEditReply && onDeleteReply ? (
            <MessageRepliesPanel
              noteId={String(note.id)}
              replies={messageReplies}
              selfUserId={selfUserId}
              onAdd={onAddReply}
              onEdit={onEditReply}
              onDelete={onDeleteReply}
            />
          ) : null}

          {/* Подвал */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-gray-500">
              {initiatorName ? `Показал: ${initiatorName}` : ""}
            </span>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Закрыть
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
