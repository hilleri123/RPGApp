'use client';

import { useMemo } from 'react';
import { MapEditor } from '../../common/MapEditor';
import { useDialogMode } from '../../common/DialogModeContext';
import { LocationList } from '@/app/services/types2';
import type { LocationTabCommonProps } from './types';
import { CanvasSizeBar } from '@/app/components/common/map/CanvasSizeBar';
import {
  DEFAULT_MAP_HEIGHT,
  DEFAULT_MAP_WIDTH,
} from '@/app/components/common/map/mapCanvasUtils';
import { useLocationCanvasExpand } from './useLocationCanvasExpand';

function getDescendantIds(allLocations: LocationList[], rootId: string): Set<string> {
  const result = new Set<string>();
  const queue = [rootId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const loc of allLocations) {
      if (loc.parent_location_id === current) {
        result.add(loc.id);
        queue.push(loc.id);
      }
    }
  }

  return result;
}

export default function RasterMapTab({ dlg, editingId }: LocationTabCommonProps) {
  const { readOnly } = useDialogMode();

  const childLocations = useMemo(() => {
    if (!editingId) return [];
    const descendantIds = getDescendantIds(dlg.lookups.locations ?? [], editingId);
    return (dlg.lookups.locations ?? []).filter((loc: LocationList) => descendantIds.has(loc.id));
  }, [dlg.lookups.locations, editingId]);

  const canvasW = dlg.form.map_width ?? DEFAULT_MAP_WIDTH;
  const canvasH = dlg.form.map_height ?? DEFAULT_MAP_HEIGHT;

  const { expanding, onExpand } = useLocationCanvasExpand({
    form: dlg.form,
    setForm: dlg.setForm,
    mapFile: dlg.assets.mapFile ?? null,
    setMapFile: (file) => dlg.setAssets((a: any) => ({ ...a, mapFile: file })),
    canvasW,
    canvasH,
    readOnly,
  });

  return (
    <div className="flex flex-col gap-3 h-full">
      <CanvasSizeBar
        width={canvasW}
        height={canvasH}
        readOnly={readOnly}
        expanding={expanding}
        onExpand={onExpand}
      />
      <MapEditor
        location={{
          id: editingId ?? 'tmp_location',
          name: dlg.form.name ?? '',
          map_url: dlg.form.map_url,
          map_width: dlg.form.map_width ?? canvasW,
          map_height: dlg.form.map_height ?? canvasH,
          map_objects: dlg.form.map_objects ?? [],
        }}
        canvasWidth={canvasW}
        canvasHeight={canvasH}
        allLocations={childLocations ?? []}
        onChange={(nextLocation: any) => {
          if (readOnly) return;
          dlg.setForm((p: any) => ({
            ...p,
            map_objects: nextLocation?.map_objects ?? [],
            map_width: nextLocation?.map_width ?? p.map_width,
            map_height: nextLocation?.map_height ?? p.map_height,
          }));
        }}
        mapFile={dlg.assets.mapFile ?? null}
        onUploadMap={(file: File) => {
          if (readOnly) return;
          dlg.setAssets((a: any) => ({ ...a, mapFile: file }));
        }}
        readOnly={readOnly}
      />
    </div>
  );
}
