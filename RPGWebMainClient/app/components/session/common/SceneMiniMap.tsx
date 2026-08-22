'use client';

import { useEffect, useMemo, useState } from 'react';
import { Map as MapIcon, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import type { Location } from '@/app/services/types2';
import type { GameSessionBase, Scene } from '@/app/services/types/session';
import MapViewerPure from './MapViewerPure';
import { useMapUiStore } from '@/app/services/stores/mapUi';
import { cn } from '@/lib/utils';

type CheckedState = boolean | 'indeterminate';

function hasMap(loc: Location | null | undefined): boolean {
  if (!loc) return false;
  if (loc.map_url && String(loc.map_url).trim()) return true;
  if ((loc as any).excalidraw_map_json) return true;
  return false;
}

function getParent(loc: Location | null, all: Location[]): Location | null {
  if (!loc?.parent_location_id) return null;
  return all.find((x) => x.id === loc.parent_location_id) ?? null;
}

export function resolveSceneMapLocation(
  currentLocation: Location | null,
  locations: Location[],
  showParentMapIfNoImage: boolean,
): Location | null {
  if (!currentLocation) return null;
  if (!showParentMapIfNoImage) return hasMap(currentLocation) ? currentLocation : null;
  if (hasMap(currentLocation)) return currentLocation;
  const parent = getParent(currentLocation, locations);
  if (parent && hasMap(parent)) return parent;
  return hasMap(currentLocation) ? currentLocation : null;
}

export default function SceneMiniMap({
  location,
  locations,
  scenes,
  session,
  enabledPolygonIds,
  className,
  showParentCheckbox = true,
}: {
  location: Location | null | undefined;
  locations: Location[];
  scenes?: Scene[];
  session?: GameSessionBase | null;
  enabledPolygonIds: string[];
  className?: string;
  showParentCheckbox?: boolean;
}) {
  const showParentMapIfNoImage = useMapUiStore((s) => s.showParentMapIfNoImage);
  const setShowParentMapIfNoImage = useMapUiStore((s) => s.setShowParentMapIfNoImage);
  const [fullscreen, setFullscreen] = useState(false);

  const currentLocation = useMemo(() => {
    const id = location?.id;
    if (!id) return location ?? null;
    return locations.find((l) => String(l.id) === String(id)) ?? location ?? null;
  }, [location, locations]);

  const parentLocation = useMemo(
    () => getParent(currentLocation, locations),
    [currentLocation, locations],
  );

  const mapLocation = useMemo(
    () => resolveSceneMapLocation(currentLocation, locations, showParentMapIfNoImage),
    [currentLocation, locations, showParentMapIfNoImage],
  );

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  if (!currentLocation) return null;

  const usingParent =
    Boolean(mapLocation) &&
    Boolean(currentLocation) &&
    mapLocation!.id !== currentLocation.id;

  return (
    <>
      <div className={cn('shrink-0 flex flex-col gap-1.5 w-[9.5rem]', className)}>
        {showParentCheckbox && parentLocation ? (
          <label className="flex items-start gap-1.5 text-[10px] leading-tight text-gray-400 cursor-pointer">
            <Checkbox
              className="mt-0.5 h-3.5 w-3.5"
              checked={showParentMapIfNoImage as CheckedState}
              onCheckedChange={(v: CheckedState) => setShowParentMapIfNoImage(Boolean(v))}
            />
            <span>Карта родителя, если нет своей</span>
          </label>
        ) : null}

        {mapLocation ? (
          <button
            type="button"
            title={usingParent ? `Карта: ${mapLocation.name}` : 'Открыть карту'}
            onClick={() => setFullscreen(true)}
            className="relative h-28 w-full overflow-hidden rounded-md border border-gray-700 bg-gray-900 text-left hover:border-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="pointer-events-none absolute inset-0">
              <MapViewerPure
                location={mapLocation}
                scenes={scenes}
                session={session ?? undefined}
                enabledPolygonIds={enabledPolygonIds}
                interactive={false}
                className="h-full w-full"
              />
            </div>
            <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-black/55 px-1.5 py-0.5 text-[10px] text-white/80">
              <MapIcon className="h-3 w-3 shrink-0" />
              <span className="truncate">{usingParent ? mapLocation.name : 'Карта'}</span>
            </div>
          </button>
        ) : (
          <div className="flex h-28 w-full items-center justify-center rounded-md border border-dashed border-gray-700 bg-gray-900/50 px-2 text-center text-[10px] text-gray-500">
            Нет карты
          </div>
        )}
      </div>

      {fullscreen && mapLocation ? (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label="Карта сцены"
          onClick={() => setFullscreen(false)}
        >
          <div
            className="flex items-center justify-between gap-2 border-b border-gray-700 bg-gray-950 px-3 py-2 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="min-w-0 text-sm font-semibold text-white truncate">
              {mapLocation.name}
              {usingParent ? (
                <span className="ml-2 text-xs font-normal text-gray-400">
                  (для {currentLocation.name})
                </span>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
              title="Закрыть (Esc)"
              onClick={() => setFullscreen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div
            className="flex-1 min-h-0"
            onClick={(e) => e.stopPropagation()}
          >
            <MapViewerPure
              location={mapLocation}
              scenes={scenes}
              session={session ?? undefined}
              enabledPolygonIds={enabledPolygonIds}
              className="h-full w-full"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
