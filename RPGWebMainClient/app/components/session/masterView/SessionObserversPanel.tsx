'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSessionWebSocket } from '@/app/services/hooks/useSessionWebSocket';
import type { Location } from '@/app/services/types2';
import type { Observer, Scene } from '@/app/services/types/session';
import { fieldControlMd } from '@/lib/fieldStyles';
import { cn } from '@/lib/utils';

function normalizeUuidOrEmpty(x: string | undefined): '' | string {
  return typeof x === 'string' && x.length ? x : '';
}

export function SessionObserversPanel({ sessionId }: { sessionId: string }) {
  const {
    locations,
    scenes,
    observers,
    isMaster,
    createObserver,
    updateObserver,
    deleteObserver,
  } = useSessionWebSocket(sessionId);

  const sceneTitleById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of scenes) m.set(String(s.id), s.name ?? String(s.id));
    return m;
  }, [scenes]);

  const locationTitleById = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of locations) m.set(String(l.id), l.name ?? String(l.id));
    return m;
  }, [locations]);

  return (
    <div className="flex flex-col min-h-[280px]">
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-xs text-gray-400">
          Коды для наблюдателей (стрим, второй экран). Не влияют на игроков.
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => createObserver()}
          disabled={!isMaster}
        >
          + Создать
        </Button>
      </div>

      <ScrollArea className="flex-1 max-h-[420px] pr-2">
        <div className="space-y-2">
          {observers.map((o) => {
            const sceneId = normalizeUuidOrEmpty(o.scene_id);
            const locationId = normalizeUuidOrEmpty(o.location_id);

            return (
              <div
                key={o.code}
                className="rounded-lg border border-gray-700 bg-gray-900/40 p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium text-white">
                    Код: <span className="font-mono">{o.code}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteObserver(o.code)}
                    disabled={!isMaster}
                  >
                    Удалить
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <label className="text-xs text-gray-400">
                    Сцена
                    <select
                      className={cn('mt-1', fieldControlMd)}
                      value={sceneId}
                      disabled={!isMaster}
                      onChange={(e) => {
                        const next: Observer = {
                          ...o,
                          scene_id: e.target.value ? e.target.value : undefined,
                        };
                        updateObserver(next);
                      }}
                    >
                      <option value="">—</option>
                      {scenes.map((s: Scene) => (
                        <option key={s.id} value={String(s.id)}>
                          {s.name ?? `Scene ${String(s.id).slice(0, 6)}`}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-xs text-gray-400">
                    Локация
                    <select
                      className={cn('mt-1', fieldControlMd)}
                      value={locationId}
                      disabled={!isMaster}
                      onChange={(e) => {
                        const next: Observer = {
                          ...o,
                          location_id: e.target.value ? e.target.value : undefined,
                        };
                        updateObserver(next);
                      }}
                    >
                      <option value="">—</option>
                      {locations.map((l: Location) => (
                        <option key={l.id} value={String(l.id)}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="text-[11px] text-gray-500">
                    Сейчас: сцена{' '}
                    <span className="text-gray-300">
                      {sceneId ? (sceneTitleById.get(sceneId) ?? sceneId) : '—'}
                    </span>
                    , локация{' '}
                    <span className="text-gray-300">
                      {locationId ? (locationTitleById.get(locationId) ?? locationId) : '—'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {observers.length === 0 ? (
            <div className="text-xs text-gray-500 italic">Обсерверов пока нет.</div>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}
