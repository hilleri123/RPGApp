'use client';

import { useMemo } from 'react';
import { MapPin } from 'lucide-react';

import type { Scene, SessionTimeline } from '@/app/services/types/session';
import {
  formatGameTimeDelta,
  formatGameTimeLabel,
  parseGameTime,
} from '@/app/components/session/common/gameTime';

function sessionTimeIso(timeline?: SessionTimeline | null): string | null {
  if (!timeline) return null;
  return timeline.current_time ?? timeline.scenario_started_at ?? null;
}

type TimelineEntry = {
  scene: Scene;
  timeMs: number | null;
  timeLabel: string;
  locationName: string;
};

export function SessionScenesTimeline({
  scenes,
  timeline,
  currentSceneId,
  onSelectScene,
  fullHeight = false,
}: {
  scenes: Scene[];
  timeline?: SessionTimeline | null;
  currentSceneId: string | null;
  onSelectScene: (sceneId: string) => void;
  fullHeight?: boolean;
}) {
  const sessionIso = sessionTimeIso(timeline);
  const sessionDate = parseGameTime(sessionIso);
  const sessionMs = sessionDate?.getTime() ?? null;

  const entries = useMemo(() => {
    const rows: TimelineEntry[] = (scenes ?? []).map((scene) => {
      const parsed = parseGameTime(scene.datetime);
      return {
        scene,
        timeMs: parsed?.getTime() ?? null,
        timeLabel: formatGameTimeLabel(scene.datetime),
        locationName: scene.location?.name ?? '—',
      };
    });

    rows.sort((a, b) => {
      if (a.timeMs == null && b.timeMs == null) return a.scene.name.localeCompare(b.scene.name, 'ru');
      if (a.timeMs == null) return 1;
      if (b.timeMs == null) return -1;
      return a.timeMs - b.timeMs;
    });

    return rows;
  }, [scenes]);

  if (!entries.length) {
    return (
      <div className="text-xs text-white/40 px-1 py-2">
        Нет сцен для таймлайна.
      </div>
    );
  }

  return (
    <div className={fullHeight ? 'flex flex-col gap-1' : 'flex flex-col gap-1 max-h-44 overflow-y-auto pr-1'}>
      {sessionMs != null ? (
        <div className="rounded border border-sky-500/30 bg-sky-500/10 px-2 py-1.5 text-xs text-sky-100 mb-1">
          <div className="font-medium">Сейчас в сессии</div>
          <div className="text-sky-200/80">{formatGameTimeLabel(sessionIso)}</div>
        </div>
      ) : null}

      {entries.map(({ scene, timeMs, timeLabel, locationName }) => {
        const active = String(scene.id) === String(currentSceneId);
        const delta =
          sessionMs != null && timeMs != null
            ? formatGameTimeDelta(timeMs, sessionMs)
            : null;
        const deltaClass =
          delta?.tone === 'ahead'
            ? 'text-emerald-400'
            : delta?.tone === 'behind'
              ? 'text-red-400'
              : 'text-white/40';

        return (
          <button
            key={scene.id}
            type="button"
            onClick={() => onSelectScene(String(scene.id))}
            className={[
              'w-full text-left rounded border px-2 py-1.5 transition-colors',
              active
                ? 'border-amber-400/50 bg-amber-500/15'
                : 'border-white/10 bg-white/5 hover:bg-white/10',
            ].join(' ')}
          >
            <div className="flex items-start gap-2">
              <div className="w-1 self-stretch rounded-full bg-white/15 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-white truncate">{scene.name}</div>
                <div className="text-[11px] text-white/50 flex items-center gap-1 truncate">
                  <MapPin className="w-3 h-3 shrink-0" />
                  {locationName}
                </div>
                <div className="text-xs text-white/70 mt-0.5">{timeLabel}</div>
                {delta ? <div className={`text-[11px] mt-0.5 ${deltaClass}`}>{delta.label}</div> : null}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
