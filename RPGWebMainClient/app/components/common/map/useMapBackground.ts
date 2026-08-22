import { useMemo } from 'react';
import { useImageNaturalSize } from './useImageNaturalSize';
import { DEFAULT_MAP_HEIGHT, DEFAULT_MAP_WIDTH, resolveCanvasSize } from './mapCanvasUtils';

export type MapMode = 'canvas' | 'raster' | 'excalidraw' | 'none';

export interface CanvasInfo {
  viewBox: string;
  bgWidth: number;
  bgHeight: number;
}

interface UseMapBackgroundOptions {
  /** Preferred: unified canvas. Legacy modes kept for callers mid-migration. */
  mode?: MapMode;
  mapUrl?: string | null;
  mapWidth?: number | null;
  mapHeight?: number | null;
  rasterSrc?: string | null;
  /** @deprecated use mapWidth/mapHeight + canvas mode */
  excalidrawPreviewVbW?: number;
  /** @deprecated use mapWidth/mapHeight + canvas mode */
  excalidrawPreviewVbH?: number;
  allPoints?: { x: number; y: number }[];
  fallbackPad?: number;
}

export function useMapBackground({
  mode = 'canvas',
  mapUrl,
  mapWidth,
  mapHeight,
  rasterSrc,
  excalidrawPreviewVbW,
  excalidrawPreviewVbH,
  allPoints = [],
  fallbackPad = 40,
}: UseMapBackgroundOptions): CanvasInfo | null {
  const src = rasterSrc ?? mapUrl ?? null;
  const rasterSize = useImageNaturalSize(src);

  return useMemo<CanvasInfo | null>(() => {
    // Unified canvas path
    if (mode === 'canvas' || mode === undefined) {
      const size = resolveCanvasSize({
        mapUrl: src,
        mapWidth,
        mapHeight,
        rasterNatural: rasterSize,
      });
      if (!size) return null;
      return {
        viewBox: `0 0 ${size.w} ${size.h}`,
        bgWidth: size.w,
        bgHeight: size.h,
      };
    }

    // Legacy fallbacks
    if (mode === 'raster' && rasterSize) {
      return {
        viewBox: `0 0 ${rasterSize.w} ${rasterSize.h}`,
        bgWidth: rasterSize.w,
        bgHeight: rasterSize.h,
      };
    }

    if (mode === 'excalidraw') {
      if (mapWidth && mapHeight) {
        return {
          viewBox: `0 0 ${mapWidth} ${mapHeight}`,
          bgWidth: mapWidth,
          bgHeight: mapHeight,
        };
      }
      if (!excalidrawPreviewVbW || !excalidrawPreviewVbH) return null;
      return {
        viewBox: `0 0 ${excalidrawPreviewVbW} ${excalidrawPreviewVbH}`,
        bgWidth: excalidrawPreviewVbW,
        bgHeight: excalidrawPreviewVbH,
      };
    }

    if (allPoints.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of allPoints) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
      const w = maxX - minX + fallbackPad * 2;
      const h = maxY - minY + fallbackPad * 2;
      return {
        viewBox: `${minX - fallbackPad} ${minY - fallbackPad} ${w} ${h}`,
        bgWidth: w,
        bgHeight: h,
      };
    }

    if (mapWidth && mapHeight) {
      return {
        viewBox: `0 0 ${mapWidth} ${mapHeight}`,
        bgWidth: mapWidth,
        bgHeight: mapHeight,
      };
    }

    return {
      viewBox: `0 0 ${DEFAULT_MAP_WIDTH} ${DEFAULT_MAP_HEIGHT}`,
      bgWidth: DEFAULT_MAP_WIDTH,
      bgHeight: DEFAULT_MAP_HEIGHT,
    };
  }, [
    mode,
    src,
    mapWidth,
    mapHeight,
    rasterSize,
    excalidrawPreviewVbW,
    excalidrawPreviewVbH,
    allPoints,
    fallbackPad,
  ]);
}

export { useImageNaturalSize } from './useImageNaturalSize';
