'use client';

import { useMemo } from 'react';
import type { Location } from '@/app/services/types2';
import type { MapOverlay, Scene, SceneCanvasBoard, SceneToken } from '@/app/services/types/session';
import MapViewerPure, { type BoardToken } from '@/app/components/session/common/MapViewerPure';

export function locationWithMasks(location: Location, masks: MapOverlay[]): Location {
  if (!masks.length) return location;
  const base = (location.excalidraw_map_json ?? { elements: [], appState: {}, files: {} }) as any;
  const elements = [...(base.elements ?? [])];
  const files = { ...(base.files ?? {}) };
  for (const mask of masks) {
    for (const el of mask.scene?.elements ?? []) {
      elements.push({ ...el, id: `${mask.id}:${el.id}` });
    }
    Object.assign(files, mask.scene?.files ?? {});
  }
  return { ...location, excalidraw_map_json: { ...base, elements, files } };
}

const KIND_COLOR: Record<SceneToken['entity_type'], string> = {
  character: '#2563eb',
  npc: '#b45309',
  item: '#047857',
  obstacle: '#7f1d1d',
};

export function assignedCanvas(scene: Scene | null | undefined, userId?: string | null): SceneCanvasBoard | null {
  const boards = scene?.canvases ?? [];
  const own = userId ? scene?.player_canvas?.[userId] : undefined;
  const preferred = own || scene?.shown_canvas_id;
  if (!preferred) return boards[0] ?? null;
  return boards.find((item) => String(item.id) === String(preferred)) ?? boards[0] ?? null;
}

export function canvasMapLocation(
  canvas: SceneCanvasBoard | null | undefined,
  locations?: Location[] | null,
): Location | null {
  if (!canvas) return null;
  const embedded = canvas.location ?? null;
  if (embedded && String(embedded.id ?? '') === String(canvas.location_id)) return embedded;
  return (locations ?? []).find((item) => String(item.id) === String(canvas.location_id)) ?? embedded;
}

export function SceneCanvasView({
  location,
  canvas,
  overlays,
  names,
  editable,
  onTokenMove,
}: {
  location: Location;
  canvas: SceneCanvasBoard;
  overlays: MapOverlay[];
  names: Record<string, string>;
  editable?: boolean;
  onTokenMove?: (index: number, next: { col: number; row: number; x: number; y: number }) => void;
}) {
  const masks = useMemo(() => {
    const enabled = new Set(canvas.mask_ids ?? []);
    return overlays.filter((item) => enabled.has(item.id) && item.location_id === canvas.location_id);
  }, [canvas.mask_ids, canvas.location_id, overlays]);
  const shown = useMemo(() => locationWithMasks(location, masks), [location, masks]);
  const tokens: BoardToken[] = (canvas.tokens ?? []).map((token) => ({
    id: `${token.entity_type}:${token.entity_id}`,
    name: names[token.entity_id] ?? token.entity_type,
    color: KIND_COLOR[token.entity_type] ?? '#334155',
    col: token.col,
    row: token.row,
    span_w: token.span_w,
    span_h: token.span_h,
    x: token.x,
    y: token.y,
  }));

  return (
    <MapViewerPure
      location={shown}
      interactive
      dimHidden={editable}
      boardTokens={tokens}
      mapGrid={location.map_grid}
      gridOn={canvas.grid_on}
      tokensEditable={editable}
      onTokenMove={onTokenMove}
    />
  );
}
