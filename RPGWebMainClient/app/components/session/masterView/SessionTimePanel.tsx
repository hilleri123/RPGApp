'use client';

import { useState } from 'react';
import { Clock } from 'lucide-react';

import type { SessionTimeline } from '@/app/services/types/session';
import { useSessionWebSocket } from '@/app/services/hooks/useSessionWebSocket';
import {
  formatGameTimeIso,
  formatGameTimeLabel,
  GAME_TIME_QUICK_SHIFTS,
  parseGameTime,
} from '@/app/components/session/common/gameTime';

function currentSessionTime(timeline?: SessionTimeline | null): string | null {
  if (!timeline) return null;
  return timeline.current_time ?? timeline.scenario_started_at ?? null;
}

export default function SessionTimePanel({
  sessionId,
  timeline,
  compact = false,
}: {
  sessionId: string;
  timeline?: SessionTimeline | null;
  compact?: boolean;
}) {
  const { setSessionTime } = useSessionWebSocket(sessionId);

  const sessionIso = currentSessionTime(timeline);
  const current = parseGameTime(sessionIso) ?? new Date(1920, 0, 1, 12, 0, 0);
  const [editing, setEditing] = useState(false);
  const [localDate, setLocalDate] = useState('');
  const [localTime, setLocalTime] = useState('');

  const send = (d: Date) => setSessionTime(formatGameTimeIso(d));

  const shift = (minutes: number) => {
    send(new Date(current.getTime() + minutes * 60_000));
  };

  const openEdit = () => {
    const pad = (n: number) => String(n).padStart(2, '0');
    setLocalDate(`${current.getFullYear()}-${pad(current.getMonth() + 1)}-${pad(current.getDate())}`);
    setLocalTime(`${pad(current.getHours())}:${pad(current.getMinutes())}`);
    setEditing(true);
  };

  const handleManualSubmit = () => {
    const d = new Date(`${localDate}T${localTime || '00:00'}:00`);
    if (!Number.isNaN(d.getTime())) {
      send(d);
      setEditing(false);
    }
  };

  const rootClass = compact
    ? 'rounded-md border border-sky-700/40 bg-sky-950/30 px-2 py-2'
    : 'mx-4 mt-2 rounded-md border border-sky-700/40 bg-sky-950/30 px-3 py-2';

  return (
    <div className={rootClass}>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-sky-300 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-sky-300/70">Игровое время сессии</div>
            <div className="text-sm text-white/90 truncate">{formatGameTimeLabel(sessionIso)}</div>
            {timeline?.scenario_started_at ? (
              <div className="text-[11px] text-white/40 truncate">
                Старт: {formatGameTimeLabel(timeline.scenario_started_at)}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="text-xs text-white/40 hover:text-white/70 underline shrink-0"
            onClick={openEdit}
          >
            изменить
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {GAME_TIME_QUICK_SHIFTS.map(({ label, minutes }) => (
            <button
              key={label}
              type="button"
              className="rounded border border-white/15 bg-white/5 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
              onClick={() => shift(minutes)}
            >
              {label}
            </button>
          ))}
        </div>

        {editing ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              className="rounded bg-zinc-800 border border-white/20 px-2 py-1 text-xs text-white"
              value={localDate}
              onChange={(e) => setLocalDate(e.target.value)}
            />
            <input
              type="time"
              className="rounded bg-zinc-800 border border-white/20 px-2 py-1 text-xs text-white"
              value={localTime}
              onChange={(e) => setLocalTime(e.target.value)}
            />
            <button
              type="button"
              className="rounded bg-sky-600 px-2.5 py-1 text-xs text-white hover:bg-sky-500"
              onClick={handleManualSubmit}
            >
              ОК
            </button>
            <button
              type="button"
              className="text-xs text-white/40 hover:text-white/70"
              onClick={() => setEditing(false)}
            >
              ✕
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
