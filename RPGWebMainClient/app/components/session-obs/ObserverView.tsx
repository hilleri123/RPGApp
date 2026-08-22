'use client';

import { Loader2 } from 'lucide-react';
import { useObserverStore } from '@/app/services/providers/ObserverWsProvider';
import MapViewerPure from '../session/common/MapViewerPure';
import { SessionPresentedEntityOverlay } from '../session/common/SessionPresentedEntityOverlay';
import { useMemo } from 'react';

function hasMapUrl(loc: any): boolean {
  return Boolean(loc?.map_url && String(loc.map_url).trim().length > 0);
}

function hasExcalidrawMap(loc: any): boolean {
  return Boolean(loc?.excalidraw_map_json?.elements?.length);
}

function findAncestorWithMap(currentLoc: any, allLocations: any[]): any | null {
  let current = currentLoc;
  while (current?.parent_location_id) {
    const parent = allLocations.find((l) => l.id === current.parent_location_id);
    if (!parent) break;
    if (hasMapUrl(parent) || hasExcalidrawMap(parent)) return parent;
    current = parent;
  }
  return null;
}

export function ObserverView() {
  const code = useObserverStore((s) => s.code);
  const conn = useObserverStore((s) => s.conn);
  const error = useObserverStore((s) => s.error);
  const loc = useObserverStore((s) => s.location);
  const locations = useObserverStore((s) => s.locations);
  const session = useObserverStore((s) => s.session);
  const scenes = useObserverStore((s) => s.scenes);
  const visiblePolygonIds = useObserverStore((s) => s.visiblePolygonIds);
  const presentedEntity = useObserverStore((s) => s.presentedEntity);

  const mapLocation = useMemo(() => {
    if (!loc) return null;
    if (hasMapUrl(loc) || hasExcalidrawMap(loc)) return loc;
    return findAncestorWithMap(loc, locations);
  }, [loc, locations]);

  const canShowMap = Boolean(mapLocation);

  // определяем тип карты для отображения лоадера
  const mapType: 'raster' | 'excalidraw' | null = useMemo(() => {
    if (!mapLocation) return null;
    if (hasMapUrl(mapLocation)) return 'raster';
    if (hasExcalidrawMap(mapLocation)) return 'excalidraw';
    return null;
  }, [mapLocation]);

  const connLabel = {
    connecting: 'Подключение…',
    open: 'Онлайн',
    closed: 'Отключено',
    error: 'Ошибка',
  }[conn] ?? null;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* шапка */}
      <div className="border-b border-gray-800 bg-gray-950 px-2 py-1 flex items-center gap-3 shrink-0">
        <div className="text-sm text-gray-300">
          Observer • code: <span className="font-mono text-gray-100">{code}</span>
        </div>
        <div className="ml-auto text-xs text-gray-500">{connLabel}</div>
      </div>

      {/* тело */}
      <div className="flex-1 min-h-0 p-2 flex flex-col gap-2">
        {conn === 'connecting' && (
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
            Ждём соединение…
          </div>
        )}

        {error && (
          <div className="rounded border border-red-900 bg-red-950/30 px-3 py-1 text-sm text-red-200">
            {error}
          </div>
        )}

        {loc ? (
          <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-2 flex-1 min-h-0 flex flex-col gap-3">
            <div className="text-md font-semibold shrink-0">{loc.name}</div>

            {canShowMap ? (
              <div className="relative flex-1 min-h-0 overflow-hidden rounded-md border border-gray-800">
                {/* лоадер поверх карты пока MapViewerPure рендерит excalidraw */}
                {/* {mapType === 'excalidraw' && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-900/60 pointer-events-none">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                  </div>
                )} */}
                <MapViewerPure
                  location={mapLocation}
                  session={session ?? undefined}
                  scenes={scenes}
                  enabledPolygonIds={visiblePolygonIds}
                  className="w-full h-full"
                  onImageClick={undefined}
                />
              </div>
            ) : conn === 'open' ? (
              <div className="text-sm text-gray-500 italic">Нет карты для этой локации.</div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-4 text-sm text-gray-500 italic">
            Локация пока не пришла.
          </div>
        )}
      </div>

      <SessionPresentedEntityOverlay presentedEntity={presentedEntity} />
    </div>
  );
}