'use client';

import { useContext } from 'react';
import { Loader2, Wifi, WifiOff } from 'lucide-react';
import { SessionSocketContext } from '@/app/services/providers/SessionWebSocketProvider';

/** Индикатор состояния WebSocket.
 *
 * Провайдер хранил `connected`, но в интерфейсе это нигде не отображалось:
 * связь могла быть потеряна, действия не уходили, и пользователь об этом
 * не знал. */
export function ConnectionStatus({ className = '' }: { className?: string }) {
  const ctx = useContext(SessionSocketContext);

  // Без провайдера показывать нечего — компонент используется и вне сессии.
  if (!ctx) return null;

  if (ctx.connected) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs text-emerald-400 ${className}`}
        title="Соединение с сервером активно"
      >
        <Wifi className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">На связи</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs text-amber-400 ${className}`}
      title="Соединение потеряно, идёт переподключение. Действия отправятся после восстановления связи."
    >
      <WifiOff className="w-3.5 h-3.5" />
      <Loader2 className="w-3 h-3 animate-spin" />
      <span className="hidden sm:inline">Переподключаемся</span>
    </span>
  );
}

/** Баннер во всю ширину — для случаев, когда индикатора в шапке мало. */
export function ConnectionLostBanner() {
  const ctx = useContext(SessionSocketContext);
  if (!ctx || ctx.connected) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-amber-950/80 border-b border-amber-700 px-3 py-1.5 text-xs text-amber-200">
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>
        Соединение потеряно, переподключаемся. Ваши действия отправятся автоматически.
      </span>
    </div>
  );
}
