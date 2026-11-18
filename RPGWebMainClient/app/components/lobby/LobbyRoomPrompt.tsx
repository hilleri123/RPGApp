'use client';

import { useEffect, useMemo, useState } from 'react';
import { Copy, Video } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/** Ссылку из лобби открываем, только если это https: мастер вводит её руками. */
function safeRoomUrl(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function storageKey(lobbyId: string): string {
  return `peregovorka:${lobbyId}`;
}

function answeredFor(lobbyId: string): string | null {
  try {
    return window.sessionStorage.getItem(storageKey(lobbyId));
  } catch {
    return null;
  }
}

function rememberAnswer(lobbyId: string, url: string): void {
  try {
    window.sessionStorage.setItem(storageKey(lobbyId), url);
  } catch {
    // без хранилища просто спросим ещё раз при следующем входе
  }
}

/**
 * Игроку в лобби: «Открыть Переговорку?» по ссылке, которую задал мастер.
 * Спрашивает один раз на ссылку за сессию браузера; кнопка в шапке открывает окно снова.
 */
export function LobbyRoomPrompt({
  lobbyId,
  roomUrl,
  password,
}: {
  lobbyId: string;
  roomUrl?: string | null;
  password?: string | null;
}) {
  const url = useMemo(() => safeRoomUrl(roomUrl), [roomUrl]);
  const roomPassword = (password ?? '').trim();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!url) {
      setOpen(false);
      return;
    }
    if (answeredFor(lobbyId) !== url) setOpen(true);
  }, [lobbyId, url]);

  if (!url) return null;

  const close = (next: boolean) => {
    if (!next) rememberAnswer(lobbyId, url);
    setOpen(next);
  };

  const openRoom = () => {
    // Прямо в обработчике клика, иначе браузер заблокирует новую вкладку.
    window.open(url, '_blank', 'noopener,noreferrer');
    close(false);
  };

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(roomPassword);
      toast.success('Пароль скопирован');
    } catch {
      toast.error('Не удалось скопировать пароль');
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0 gap-1.5 border-white/10 text-white/90 hover:text-white"
        onClick={() => setOpen(true)}
      >
        <Video className="h-4 w-4" />
        Переговорка
      </Button>

      <AlertDialog open={open} onOpenChange={close}>
        <AlertDialogContent className="bg-gray-900 border border-white/10 text-white max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Открыть Переговорку?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Мастер приготовил комнату для игры. Она откроется в соседней вкладке.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {roomPassword ? (
            <div className="flex items-center gap-2 rounded border border-white/10 bg-gray-800/60 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-400">Пароль комнаты</p>
                <p className="font-mono text-sm text-white break-all">{roomPassword}</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="shrink-0 gap-1.5 text-gray-200 hover:text-white"
                onClick={copyPassword}
              >
                <Copy className="h-4 w-4" />
                Скопировать
              </Button>
            </div>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 bg-transparent text-gray-200 hover:text-white">
              Не сейчас
            </AlertDialogCancel>
            <AlertDialogAction onClick={openRoom}>Да, открыть</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
