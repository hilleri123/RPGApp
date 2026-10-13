'use client';

import type { LocationList } from '@/app/services/types2';
import { MapCanvas } from '@/app/components/common/map/MapCanvas';
import { isMapCanvasHelperElement } from '@/app/components/common/map/excalidrawCanvasBounds';
import { useExcalidrawPreview } from '@/app/components/common/map/useExcalidrawPreview';
import { useMapBackground } from '@/app/components/common/map/useMapBackground';
import { TYPE_ICONS } from '@/lib/constants';

function hasDrawableExcalidraw(json: LocationList['excalidraw_map_json']): boolean {
  const elements = json?.elements;
  if (!Array.isArray(elements)) return false;
  return elements.some(
    (el: { isDeleted?: boolean; id?: string } | null) =>
      el && !el.isDeleted && !isMapCanvasHelperElement(el),
  );
}

export function locationHasMapPreview(location: LocationList): boolean {
  return Boolean(location.map_url) || hasDrawableExcalidraw(location.excalidraw_map_json);
}

/** 48×48 crop of the same board the map uses: raster underlay, then the Excalidraw drawing. */
export function LocationMapThumb({ location }: { location: LocationList }) {
  const hasDrawing = hasDrawableExcalidraw(location.excalidraw_map_json);
  const canvasInfo = useMapBackground({
    mode: 'canvas',
    mapUrl: location.map_url,
    mapWidth: location.map_width,
    mapHeight: location.map_height,
    rasterSrc: location.map_url,
  });
  const preview = useExcalidrawPreview(
    location.excalidraw_map_json,
    hasDrawing && Boolean(canvasInfo),
    canvasInfo?.bgWidth,
    canvasInfo?.bgHeight,
  );

  return (
    <div className="relative w-12 h-12 shrink-0">
      {canvasInfo ? (
        <div className="w-12 h-12 overflow-hidden rounded-lg shadow">
          <MapCanvas
            canvasInfo={canvasInfo}
            rasterSrc={location.map_url}
            excalidrawPreviewUrl={preview?.url}
            preserveAspectRatio="xMidYMid slice"
            svgClassName="w-full h-full"
          />
        </div>
      ) : location.map_url ? (
        <img
          src={location.map_url}
          alt={location.name}
          className="w-12 h-12 object-cover rounded-lg shadow"
        />
      ) : null}

      {location.icon_url ? (
        <div className="absolute top-1 right-1 z-10">
          <img src={location.icon_url} alt="" className="w-3 h-3 opacity-90" />
        </div>
      ) : (
        <div className="absolute top-1 right-1 z-10">
          <TYPE_ICONS.location className="w-3 h-3 opacity-90" color="rgba(255,255,255,0.95)" />
        </div>
      )}

      <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-md bg-black/45 backdrop-blur-[1px]" />
    </div>
  );
}
