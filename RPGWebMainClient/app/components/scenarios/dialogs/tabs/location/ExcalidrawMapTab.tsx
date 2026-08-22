'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { CaptureUpdateAction } from '@excalidraw/excalidraw';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/types/element/types';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types/types';
import ExcalidrawDynamic from './ExcalidrawDynamic';
import type { LocationTabCommonProps } from './types';
import { useDialogMode } from '../../common/DialogModeContext';
import type { MapObjectPolygonCreate } from '@/app/services/types2';
import { CanvasSizeBar } from '@/app/components/common/map/CanvasSizeBar';
import {
  DEFAULT_MAP_HEIGHT,
  DEFAULT_MAP_WIDTH,
} from '@/app/components/common/map/mapCanvasUtils';
import {
  constrainSceneToCanvas,
  isMapCanvasHelperElement,
  MAP_CANVAS_FRAME_ID,
} from '@/app/components/common/map/excalidrawCanvasBounds';
import { useLocationCanvasExpand } from './useLocationCanvasExpand';

type Point = { x: number; y: number };

function stableSerialize(value: any): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

const SHAPE_TYPES = new Set(['rectangle', 'ellipse', 'diamond', 'freedraw', 'line', 'arrow']);

function isShape(el: ExcalidrawElement) {
  return SHAPE_TYPES.has(el.type) && !el.isDeleted;
}

function rectPolygon(x: number, y: number, w: number, h: number): Point[] {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

function diamondPolygon(x: number, y: number, w: number, h: number): Point[] {
  return [
    { x: x + w / 2, y },
    { x: x + w, y: y + h / 2 },
    { x: x + w / 2, y: y + h },
    { x, y: y + h / 2 },
  ];
}

function ellipsePolygon(x: number, y: number, w: number, h: number, steps = 32): Point[] {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rx = Math.abs(w) / 2;
  const ry = Math.abs(h) / 2;
  const pts: Point[] = [];

  for (let i = 0; i < steps; i++) {
    const a = (Math.PI * 2 * i) / steps;
    pts.push({
      x: cx + Math.cos(a) * rx,
      y: cy + Math.sin(a) * ry,
    });
  }

  return pts;
}

function normalizeLinearPoints(points: [number, number][], ox: number, oy: number): Point[] {
  return points.map(([px, py]) => ({
    x: ox + px,
    y: oy + py,
  }));
}

function dedupeClosePoints(points: Point[], epsilon = 0.01): Point[] {
  if (points.length <= 1) return points;
  const out: Point[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = out[out.length - 1];
    const curr = points[i];
    if (Math.abs(prev.x - curr.x) > epsilon || Math.abs(prev.y - curr.y) > epsilon) {
      out.push(curr);
    }
  }
  if (out.length > 2) {
    const first = out[0];
    const last = out[out.length - 1];
    if (Math.abs(first.x - last.x) <= epsilon && Math.abs(first.y - last.y) <= epsilon) {
      out.pop();
    }
  }
  return out;
}

function elementToPolygon(el: ExcalidrawElement): Point[] {
  const x = Number(el.x ?? 0);
  const y = Number(el.y ?? 0);
  // @ts-ignore
  const w = Number(el.width ?? 0);
  // @ts-ignore
  const h = Number(el.height ?? 0);

  if (el.type === 'rectangle') return rectPolygon(x, y, w, h);
  if (el.type === 'diamond') return diamondPolygon(x, y, w, h);
  if (el.type === 'ellipse') return ellipsePolygon(x, y, w, h, 32);

  if (el.type === 'line' || el.type === 'arrow' || el.type === 'freedraw') {
    // @ts-ignore
    const pts: [number, number][] = Array.isArray(el.points) ? el.points : [];
    return dedupeClosePoints(normalizeLinearPoints(pts, x, y));
  }

  return [];
}

function elementColor(el: ExcalidrawElement): string {
  // @ts-ignore
  const fill: string = el.backgroundColor ?? '';
  // @ts-ignore
  const stroke: string = el.strokeColor ?? '#6366f1';
  return fill && fill !== 'transparent' && fill !== '#ffffff00' ? fill : stroke;
}

function isLine(el: ExcalidrawElement): boolean {
  return el.type === 'line' || el.type === 'arrow' || el.type === 'freedraw';
}

function extractLabelForElement(
  el: ExcalidrawElement,
  textById: Record<string, string>
): string {
  return textById[el.id] ?? `${el.type} ${el.id.slice(0, 4)}`;
}

function elementsToMapObjects(
  elements: readonly ExcalidrawElement[],
  existingMapObjects: MapObjectPolygonCreate[],
  locationId: string | null | undefined,
): MapObjectPolygonCreate[] {
  const textById: Record<string, string> = {};

  for (const el of elements) {
    if (el.type === 'text' && !el.isDeleted) {
      // @ts-ignore
      const container: string | undefined = el.containerId;
      // @ts-ignore
      if (container) textById[container] = el.text ?? '';
    }
  }

  const existingByInternalId = new Map<string, MapObjectPolygonCreate>(
    (existingMapObjects ?? [])
      .filter((o) => o.internal_id)
      .map((o) => [o.internal_id!, o])
  );

  const result: MapObjectPolygonCreate[] = [];

  for (const el of elements) {
    if (isMapCanvasHelperElement(el)) continue;
    if (!isShape(el)) continue;

    const polygon = elementToPolygon(el);
    if (polygon.length < 2) continue;

    const existing = existingByInternalId.get(el.id);

    const obj: MapObjectPolygonCreate = {
      ...existing,
      internal_id: el.id,
      name: existing?.name ?? extractLabelForElement(el, textById),
      color: existing?.color ?? elementColor(el),
      polygon_list: polygon,
      source_location_id: locationId ?? (existing?.source_location_id ?? ''),
      target_location_id: existing?.target_location_id ?? null,
      is_shown: existing?.is_shown ?? true,
      is_line: existing?.is_line ?? isLine(el),
      is_filled: existing?.is_filled ?? !isLine(el),
      alpha: existing?.alpha ?? 0.5,
    };

    result.push(obj);
  }

  return result;
}

export default function ExcalidrawMapTab({ dlg, editingId }: LocationTabCommonProps) {
  const { readOnly } = useDialogMode();

  const [mapPreviewUrl, setMapPreviewUrl] = React.useState<string | null>(null);
  useEffect(() => {
    if (dlg.assets.mapFile) {
      const url = URL.createObjectURL(dlg.assets.mapFile);
      setMapPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setMapPreviewUrl(dlg.form.map_url ?? null);
  }, [dlg.assets.mapFile, dlg.form.map_url]);

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

  const initialDataRef = useRef<any>(null);
  const latestSceneRef = useRef<any>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedSerializedRef = useRef<string>('');
  const canvasKeyRef = useRef(`${canvasW}x${canvasH}`);
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const constrainingRef = useRef(false);

  const buildEditorScene = useCallback(
    (rawElements: readonly any[] | undefined, appState?: any, files?: any) => {
      const user = (rawElements ?? []).filter((el) => !isMapCanvasHelperElement(el));
      const { elements } = constrainSceneToCanvas(user, canvasW, canvasH);
      return {
        elements,
        appState: {
          viewBackgroundColor: mapPreviewUrl ? 'transparent' : '#ffffff',
          ...(appState ?? {}),
        },
        files: files ?? {},
      };
    },
    [canvasW, canvasH, mapPreviewUrl],
  );

  // Remount Excalidraw when canvas expand shifts elements so initialData picks up new scene.
  const sceneKey = `${dlg.form.map_width ?? canvasW}x${dlg.form.map_height ?? canvasH}`;
  if (canvasKeyRef.current !== sceneKey && dlg.form.excalidraw_map_json) {
    canvasKeyRef.current = sceneKey;
    initialDataRef.current = buildEditorScene(
      dlg.form.excalidraw_map_json?.elements,
      dlg.form.excalidraw_map_json?.appState,
      dlg.form.excalidraw_map_json?.files,
    );
    latestSceneRef.current = initialDataRef.current;
    lastSavedSerializedRef.current = '';
  }

  if (!initialDataRef.current) {
    initialDataRef.current = buildEditorScene(
      dlg.form?.excalidraw_map_json?.elements,
      dlg.form?.excalidraw_map_json?.appState,
      dlg.form?.excalidraw_map_json?.files,
    );
  }

  if (!latestSceneRef.current) {
    latestSceneRef.current = initialDataRef.current;
  }

  if (!lastSavedSerializedRef.current) {
    const stripped = {
      ...initialDataRef.current,
      elements: (initialDataRef.current.elements ?? []).filter(
        (el: any) => !isMapCanvasHelperElement(el),
      ),
    };
    lastSavedSerializedRef.current = stableSerialize(
      dlg.form?.excalidraw_map_json ?? stripped,
    );
  }

  const flushToForm = useCallback(() => {
    if (readOnly) return;

    const live = latestSceneRef.current ?? {
      elements: [],
      appState: { viewBackgroundColor: '#ffffff' },
      files: {},
    };

    // Persist without editor-only helpers (masks / border).
    const nextScene = {
      ...live,
      elements: (live.elements ?? []).filter((el: any) => !isMapCanvasHelperElement(el)),
    };

    const nextSerialized = stableSerialize(nextScene);
    if (!nextSerialized) return;
    if (nextSerialized === lastSavedSerializedRef.current) return;

    lastSavedSerializedRef.current = nextSerialized;

    dlg.setForm((p: any) => {
      const prevSerialized = stableSerialize(p.excalidraw_map_json ?? null);
      if (prevSerialized === nextSerialized) return p;

      const nextMapObjects = elementsToMapObjects(
        nextScene.elements ?? [],
        p.map_objects ?? [],
        editingId,
      );

      return {
        ...p,
        excalidraw_map_json: nextScene,
        map_objects: nextMapObjects,
        map_width: p.map_width ?? canvasW,
        map_height: p.map_height ?? canvasH,
      };
    });
  }, [dlg, readOnly, editingId, canvasW, canvasH]);

  const scheduleFlush = useCallback(() => {
    if (readOnly) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(flushToForm, 400);
  }, [flushToForm, readOnly]);

  const handleChange = useCallback(
    (els: readonly ExcalidrawElement[], appState: any, files: any) => {
      if (constrainingRef.current) return;

      const { elements: constrained, changed } = constrainSceneToCanvas(
        els,
        canvasW,
        canvasH,
      );

      if (changed && apiRef.current) {
        constrainingRef.current = true;
        apiRef.current.updateScene({
          elements: constrained as any,
          captureUpdate: CaptureUpdateAction.NEVER,
        });
        constrainingRef.current = false;
      }

      latestSceneRef.current = {
        elements: constrained,
        appState: {
          viewBackgroundColor: appState?.viewBackgroundColor,
          gridSize: appState?.gridSize,
          zoom: appState?.zoom,
          scrollX: appState?.scrollX,
          scrollY: appState?.scrollY,
          theme: appState?.theme,
        },
        files: files ?? {},
      };
      scheduleFlush();
    },
    [scheduleFlush, canvasW, canvasH],
  );

  const handleApi = useCallback(
    (api: ExcalidrawImperativeAPI) => {
      apiRef.current = api;
      // Fit the canvas frame into view so bounds are obvious.
      try {
        const frame = (api.getSceneElements() as any[]).find(
          (el) => el.id === MAP_CANVAS_FRAME_ID,
        );
        if (frame) {
          api.scrollToContent(frame, { fitToViewport: true, viewportZoomFactor: 0.9 });
        }
      } catch {
        /* ignore */
      }
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col gap-3 h-full">
      <CanvasSizeBar
        width={canvasW}
        height={canvasH}
        readOnly={readOnly}
        expanding={expanding}
        onExpand={onExpand}
      />
      <div className="text-xs text-muted-foreground">
        Векторный слой поверх холста {canvasW}×{canvasH}
        {mapPreviewUrl ? ' (растровый фон)' : ' (белый фон)'}.
        Рисование только внутри фиолетовой рамки.
      </div>
      <div
        className="rounded-xl overflow-hidden border border-white/10 relative"
        style={{ height: 560 }}
      >
        {mapPreviewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mapPreviewUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-contain pointer-events-none opacity-40"
          />
        )}
        <div className="relative z-10 h-full">
          <ExcalidrawDynamic
            key={sceneKey}
            theme="dark"
            initialData={initialDataRef.current}
            onChange={handleChange}
            excalidrawAPI={handleApi}
            UIOptions={{
              canvasActions: {
                export: false,
                loadScene: false,
                saveToActiveFile: false,
                saveAsImage: false,
                changeViewBackgroundColor: false,
                clearCanvas: false,
                toggleTheme: false,
              },
              tools: { image: false },
            }}
          />
        </div>
      </div>
    </div>
  );
}
