'use client';

import { useMemo, useState } from 'react';
import { ArrowLeftRight, Clock } from 'lucide-react';
import Panel from './Panel';
import type { Scene, SessionTimeline } from '@/app/services/types/session';
import { useParams } from 'next/navigation';
import { useSessionWebSocket } from '@/app/services/hooks/useSessionWebSocket';
import {
  formatGameTimeDelta,
  formatGameTimeIso,
  formatGameTimeLabel,
  GAME_TIME_QUICK_SHIFTS,
  parseGameTime,
} from '@/app/components/session/common/gameTime';

function sessionTimeIso(timeline?: SessionTimeline | null): string | null {
  if (!timeline) return null;
  return timeline.current_time ?? timeline.scenario_started_at ?? null;
}

export default function SceneTimePanel({
  scene,
  timeline,
}: {
  scene: Scene;
  timeline?: SessionTimeline | null;
}) {
  const params = useParams<{ id: string }>();
  const { setSceneTime, setSessionTime } = useSessionWebSocket(params.id);

  const sessionIso = sessionTimeIso(timeline);
  const current = parseGameTime(scene.datetime) ?? new Date(1920, 0, 1, 12, 0, 0);
  const sessionDate = parseGameTime(sessionIso);
  const [editing, setEditing] = useState(false);
  const [localDate, setLocalDate] = useState('');
  const [localTime, setLocalTime] = useState('');

  const delta = useMemo(() => {
    if (!sessionDate) return null;
    return formatGameTimeDelta(current.getTime(), sessionDate.getTime());
  }, [current, sessionDate]);

  const send = (d: Date) => setSceneTime(scene.id, formatGameTimeIso(d));

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

  const syncSceneToSession = () => {
    if (!sessionIso) return;
    setSceneTime(scene.id, sessionIso);
  };

  const syncSessionToScene = () => {
    if (!scene.datetime) return;
    setSessionTime(scene.datetime);
  };

  const deltaClass =
    delta?.tone === 'ahead'
      ? 'text-emerald-400'
      : delta?.tone === 'behind'
        ? 'text-red-400'
        : 'text-white/50';

  return (
    <Panel title="Время локации">
      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <Clock className="w-4 h-4 text-white/40 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-sm text-white/80">{formatGameTimeLabel(scene.datetime)}</div>
            {sessionDate && delta ? (
              <div className={`text-xs mt-1 ${deltaClass}`}>{delta.label}</div>
            ) : (
              <div className="text-xs mt-1 text-white/40">Сессия: {formatGameTimeLabel(sessionIso)}</div>
            )}
          </div>
          <button
            type="button"
            className="text-xs text-white/40 hover:text-white/70 underline shrink-0"
            onClick={openEdit}
          >
            изменить
          </button>
        </div>

        {sessionIso ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded border border-red-400/30 bg-red-500/10 px-2.5 py-1 text-xs text-red-200 hover:bg-red-500/20"
              onClick={syncSceneToSession}
              title="Подтянуть время локации к времени сессии"
            >
              <ArrowLeftRight className="w-3 h-3" />
              К сессии
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-200 hover:bg-emerald-500/20"
              onClick={syncSessionToScene}
              disabled={!scene.datetime}
              title="Сдвинуть время сессии к времени локации"
            >
              <ArrowLeftRight className="w-3 h-3" />
              В сессию
            </button>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-1.5">
          {GAME_TIME_QUICK_SHIFTS.map(({ label, minutes }) => (
            <button
              key={label}
              type="button"
              className="rounded border border-white/20 bg-white/5 px-2.5 py-1 text-xs text-white/70 hover:bg-white/10"
              onClick={() => shift(minutes)}
            >
              {label}
            </button>
          ))}
        </div>

        {editing ? (
          <div className="flex flex-wrap items-center gap-2 rounded border border-white/20 bg-white/5 px-2 py-2">
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
              className="rounded bg-blue-600 px-2.5 py-1 text-xs text-white hover:bg-blue-500"
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
    </Panel>
  );
}
