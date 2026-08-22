'use client';

import { useCallback, useState } from 'react';
import {
  expandDelta,
  expandRasterImageFile,
  MAP_EXPAND_STEP,
  shiftExcalidrawScene,
  shiftMapObjects,
  type ExpandDir,
} from '@/app/components/common/map/mapCanvasUtils';

type LocationFormLike = {
  map_url?: string | null;
  map_width?: number | null;
  map_height?: number | null;
  excalidraw_map_json?: any;
  map_objects?: any[];
};

/**
 * Expand shared location canvas. With map_url — rewrite raster (size = image).
 * Without — grow map_width/map_height. W/N also shift overlays.
 */
export function useLocationCanvasExpand(opts: {
  form: LocationFormLike;
  setForm: (updater: (prev: any) => any) => void;
  mapFile: File | null;
  setMapFile: (file: File | null) => void;
  canvasW: number;
  canvasH: number;
  readOnly?: boolean;
}) {
  const {
    form,
    setForm,
    mapFile,
    setMapFile,
    canvasW,
    canvasH,
    readOnly = false,
  } = opts;
  const [expanding, setExpanding] = useState(false);

  const onExpand = useCallback(
    async (dir: ExpandDir) => {
      if (readOnly) return;
      const { dw, dh, dx, dy } = expandDelta(dir, MAP_EXPAND_STEP);
      const hasRaster = Boolean(mapFile || form.map_url);

      if (hasRaster) {
        setExpanding(true);
        try {
          const src = mapFile ?? form.map_url!;
          const { file, width, height, dx: sdx, dy: sdy } = await expandRasterImageFile(
            src,
            dir,
            MAP_EXPAND_STEP,
            mapFile?.name ?? 'map.png',
          );
          setMapFile(file);
          setForm((p: any) => ({
            ...p,
            map_width: width,
            map_height: height,
            map_objects: shiftMapObjects(p.map_objects ?? [], sdx, sdy),
            excalidraw_map_json: shiftExcalidrawScene(p.excalidraw_map_json, sdx, sdy),
          }));
        } finally {
          setExpanding(false);
        }
        return;
      }

      setForm((p: any) => ({
        ...p,
        map_width: (p.map_width ?? canvasW) + dw,
        map_height: (p.map_height ?? canvasH) + dh,
        map_objects: shiftMapObjects(p.map_objects ?? [], dx, dy),
        excalidraw_map_json: shiftExcalidrawScene(p.excalidraw_map_json, dx, dy),
      }));
    },
    [readOnly, mapFile, form.map_url, setMapFile, setForm, canvasW, canvasH],
  );

  return { expanding, onExpand };
}
