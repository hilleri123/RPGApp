'use client';

import { v4 as uuidv4 } from 'uuid';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Eye, EyeOff, MapPin, Plus, X } from 'lucide-react';
import type { LocationList, MapObjectPolygonCreate, SubLocationRef } from '@/app/services/types2';
import type { LocationSublocTabProps } from './types';
import { MapCanvas } from '@/app/components/common/map/MapCanvas';
import { useMapBackground } from '@/app/components/common/map/useMapBackground';
import { useExcalidrawPreview } from '@/app/components/common/map/useExcalidrawPreview';
import {
  DEFAULT_MAP_HEIGHT,
  DEFAULT_MAP_WIDTH,
} from '@/app/components/common/map/mapCanvasUtils';

// ─── типы ─────────────────────────────────────────────────────────────────────

type Point = { x: number; y: number };

type ShapeRow = {
  id: string;
  name: string;
  color: string;
  polygon: Point[];   // ← polygon, не polygon_list
  is_shown: boolean;
  is_line?: boolean;
};

// ─── svg-хелперы ──────────────────────────────────────────────────────────────

function pointsToSvgPolygon(points: Point[]) {
  return points.map((p) => `${p.x},${p.y}`).join(' ');
}
function pointsToSvgPolyline(points: Point[]) {
  return points.map((p) => `${p.x},${p.y}`).join(' ');
}
function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const n = parseInt(full, 16);
  if (isNaN(n)) return '99,102,241';
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

function normalizeToShapes(mapObjects: MapObjectPolygonCreate[]): ShapeRow[] {
  return (mapObjects ?? [])
    .map((obj: any) => ({
      id: String(obj.internal_id ?? obj.id ?? Math.random()),
      name: obj.name ?? 'Без названия',
      color: obj.color ?? '#6366f1',
      polygon: (obj.polygon_list ?? obj.polygon ?? []) as Point[],
      is_shown: obj.is_shown ?? true,
      is_line: obj.is_line ?? false,
    }))
    .filter((s) => s.polygon.length >= 2);
}

// ─── инициализация sublocations ───────────────────────────────────────────────

function buildInitialSublocations(
  editingId: string | null | undefined,
  lookupLocations: LocationList[],
): SubLocationRef[] {
  if (!editingId) return [];
  return lookupLocations
    .filter((l) => String(l.parent_location_id) === String(editingId))
    .map((l) => ({ id: String(l.id), name: l.name }));
}

// ─── компонент ────────────────────────────────────────────────────────────────

export default function SublocationsTab({ dlg, editingId }: LocationSublocTabProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [success, setSuccess] = useState<string | null>(null);

  // ── инициализация sublocations ────────────────────────────────────────────
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    const current: SubLocationRef[] = (dlg.form as any).sublocations ?? [];
    if (current.length > 0) { initializedRef.current = true; return; }
    const fromLookups = buildInitialSublocations(editingId, dlg.lookups?.locations ?? []);
    if (fromLookups.length > 0) {
      dlg.setForm((p: any) => ({ ...p, sublocations: fromLookups }));
    }
    initializedRef.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId]);

  useEffect(() => { initializedRef.current = false; }, [editingId]);

  // ── sublocations ──────────────────────────────────────────────────────────
  const sublocations: SubLocationRef[] = (dlg.form as any).sublocations ?? [];
  const activeSublocations = useMemo(() => sublocations.filter((s) => !s._deleted), [sublocations]);
  const deletedSublocations = useMemo(() => sublocations.filter((s) => s._deleted), [sublocations]);

  const patchSublocations = useCallback(
    (updater: (prev: SubLocationRef[]) => SubLocationRef[]) => {
      dlg.setForm((p: any) => ({ ...p, sublocations: updater(p.sublocations ?? []) }));
    },
    [dlg],
  );

  const renameSublocation = useCallback(
    (idx: number, name: string) => {
      patchSublocations((prev) => {
        const updated = prev.map((s, i) => (i === idx ? { ...s, name } : s));
        const sub = updated[idx];
        // синхронизируем имя связанного полигона
        if (sub?.id) {
          dlg.setForm((p: any) => ({
            ...p,
            map_objects: (p.map_objects ?? []).map((obj: any) =>
              String(obj.target_location_id) === String(sub.id)
                ? { ...obj, name }
                : obj,
            ),
          }));
        }
        return updated;
      });
    },
    [patchSublocations, dlg],
  );

  const softDeleteSublocation = useCallback(
    (idx: number) => {
      patchSublocations((prev) => {
        const sub = prev[idx];
        // отвязываем полигон
        if (sub?.id) {
          dlg.setForm((p: any) => ({
            ...p,
            map_objects: (p.map_objects ?? []).map((obj: any) =>
              String(obj.target_location_id) === String(sub.id)
                ? { ...obj, target_location_id: null }
                : obj,
            ),
          }));
        }
        return prev.map((s, i) => {
          if (i !== idx) return s;
          if (s._new) return null as any;
          return { ...s, _deleted: true };
        }).filter(Boolean);
      });
    },
    [patchSublocations, dlg],
  );

  const restoreSublocation = useCallback(
    (idx: number) => {
      patchSublocations((prev) => prev.map((s, i) => (i === idx ? { ...s, _deleted: false } : s)));
    },
    [patchSublocations],
  );

  // ── shapes ────────────────────────────────────────────────────────────────
  const shapes = useMemo<ShapeRow[]>(
    () => normalizeToShapes(dlg.form.map_objects ?? []),
    [dlg.form.map_objects],
  );

  const [rasterSrc, setRasterSrc] = useState<string | null>(null);
  useEffect(() => {
    if (dlg.assets.mapFile) {
      const url = URL.createObjectURL(dlg.assets.mapFile);
      setRasterSrc(url);
      return () => URL.revokeObjectURL(url);
    }
    setRasterSrc(dlg.form?.map_url || null);
  }, [dlg.assets.mapFile, dlg.form?.map_url]);

  const canvasW = dlg.form?.map_width ?? DEFAULT_MAP_WIDTH;
  const canvasH = dlg.form?.map_height ?? DEFAULT_MAP_HEIGHT;

  const canvasInfo = useMapBackground({
    mode: 'canvas',
    mapUrl: rasterSrc,
    mapWidth: canvasW,
    mapHeight: canvasH,
    rasterSrc,
  });

  const excalidrawPreview = useExcalidrawPreview(
    dlg.form?.excalidraw_map_json,
    Boolean(dlg.form?.excalidraw_map_json?.elements?.length),
    canvasInfo?.bgWidth ?? canvasW,
    canvasInfo?.bgHeight ?? canvasH,
  );

  // ── map objects ───────────────────────────────────────────────────────────
  const updateMapObject = useCallback(
    (id: string, patch: Partial<MapObjectPolygonCreate>) => {
      dlg.setForm((p: any) => ({
        ...p,
        map_objects: (p.map_objects ?? []).map((obj: any) =>
          (obj.internal_id ?? obj.id) === id ? { ...obj, ...patch } : obj,
        ),
      }));
    },
    [dlg],
  );

  const removeMapObject = useCallback(
    (id: string) => {
      dlg.setForm((p: any) => ({
        ...p,
        map_objects: (p.map_objects ?? []).filter(
          (obj: any) => String(obj.internal_id ?? obj.id ?? '') !== id,
        ),
      }));
      setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
    },
    [dlg],
  );

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // ── handleCreate ──────────────────────────────────────────────────────────
  const handleCreate = () => {
    if (selected.size === 0) return;
    const existingActiveNames = new Set(activeSublocations.map((s) => s.name.toLowerCase()));

    // shape.id → новый UUID подлокации
    const linkMap = new Map<string, string>(); // shapeId → newLocationId

    const toAdd: SubLocationRef[] = shapes
      .filter((s) => selected.has(s.id))
      .filter((s) => !existingActiveNames.has(s.name.toLowerCase()))
      .map((s) => {
        const newId = uuidv4();
        linkMap.set(s.id, newId);
        return { id: newId, name: s.name, _new: true };
      });

    if (toAdd.length === 0) {
      setSuccess('Все выбранные уже добавлены');
      return;
    }

    // добавляем подлокации
    patchSublocations((prev) => [...prev, ...toAdd]);

    // проставляем target_location_id полигонам
    if (linkMap.size > 0) {
      dlg.setForm((p: any) => ({
        ...p,
        map_objects: (p.map_objects ?? []).map((obj: any) => {
          const shapeId = String(obj.internal_id ?? obj.id ?? '');
          const linkedId = linkMap.get(shapeId);
          return linkedId ? { ...obj, target_location_id: linkedId } : obj;
        }),
      }));
    }

    setSelected(new Set());
    setSuccess(`Добавлено: ${toAdd.length}`);
    setTimeout(() => setSuccess(null), 2500);
  };

  // ── рендер полигона ───────────────────────────────────────────────────────
  const renderShape = (s: ShapeRow) => {
    const checked = selected.has(s.id);
    const rgb = hexToRgb(s.color);
    if (s.is_line) return (
      <g key={s.id} onClick={() => toggle(s.id)} style={{ cursor: 'pointer' }}>
        <polyline
          points={pointsToSvgPolyline(s.polygon)}
          fill="none"
          stroke={s.color}
          strokeWidth={checked ? 3 : 2}
          strokeDasharray={checked ? undefined : '6 3'}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    );
    return (
      <g key={s.id} onClick={() => toggle(s.id)} style={{ cursor: 'pointer' }}>
        <polygon
          points={pointsToSvgPolygon(s.polygon)}
          fill={`rgba(${rgb},${checked ? 0.45 : 0.18})`}
          stroke={s.color}
          strokeWidth={checked ? 2.5 : 1.5}
          strokeDasharray={checked ? undefined : '6 3'}
        />
      </g>
    );
  };

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="text-xs text-muted-foreground shrink-0">
        Единый холст {canvasInfo?.bgWidth ?? canvasW}×{canvasInfo?.bgHeight ?? canvasH}
        — растр и вектор вместе.
      </div>

      <div className="flex gap-3 min-h-0" style={{ height: 560 }}>
        {/* SVG-карта */}
        <div className="flex-1 min-w-0 rounded-xl overflow-hidden border border-white/10 bg-[#0f1117]">
          <MapCanvas
            canvasInfo={canvasInfo}
            mode="canvas"
            rasterSrc={rasterSrc}
            excalidrawPreviewUrl={excalidrawPreview?.url}
            emptyText="Нет карты и полигонов."
          >
            {shapes.filter((s) => s.is_shown).map(renderShape)}
          </MapCanvas>
        </div>

        {/* Правая панель */}
        <div className="w-72 shrink-0 flex flex-col gap-3 min-h-0 overflow-y-auto">

          {/* ── Подлокации ── */}
          <div className="flex flex-col gap-1 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                Подлокации
              </span>
              <button
                type="button"
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5"
                onClick={() => {
                  patchSublocations((prev) => [
                    ...prev,
                    { id: undefined, name: 'Новая локация', _new: true },
                  ]);
                }}
              >
                <Plus className="w-3 h-3" />
                Добавить
              </button>
            </div>

            {sublocations.length === 0 && (
              <div className="text-xs text-gray-600 py-1">Нет подлокаций</div>
            )}

            {activeSublocations.map((loc, idx) => {
              const globalIdx = sublocations.indexOf(loc);
              return (
                <div
                  key={loc.id ?? `new-${idx}`}
                  className="flex items-center gap-1.5 rounded-md border border-white/10 px-2 py-1 bg-white/5"
                >
                  <MapPin className="w-3 h-3 text-indigo-400 shrink-0" />
                  <input
                    type="text"
                    value={loc.name}
                    onChange={(e) => renameSublocation(globalIdx, e.target.value)}
                    className="flex-1 min-w-0 bg-transparent text-xs text-gray-200 border-b border-transparent focus:border-white/20 focus:outline-none py-0.5"
                  />
                  {loc._new && (
                    <span className="text-[9px] px-1 rounded bg-green-500/20 text-green-400 shrink-0">
                      новая
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => softDeleteSublocation(globalIdx)}
                    className="text-gray-600 hover:text-red-400 shrink-0"
                    title="Удалить"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}

            {deletedSublocations.length > 0 && (
              <>
                <div className="text-[10px] text-gray-600 mt-1">Будут удалены при сохранении:</div>
                {deletedSublocations.map((loc, idx) => {
                  const globalIdx = sublocations.indexOf(loc);
                  return (
                    <div
                      key={loc.id ?? `del-${idx}`}
                      className="flex items-center gap-1.5 rounded-md border border-white/5 px-2 py-1 opacity-40"
                    >
                      <MapPin className="w-3 h-3 text-gray-500 shrink-0" />
                      <span className="flex-1 min-w-0 text-xs text-gray-500 line-through truncate">
                        {loc.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => restoreSublocation(globalIdx)}
                        className="text-gray-600 hover:text-green-400 shrink-0 text-[10px]"
                        title="Восстановить"
                      >
                        ↩
                      </button>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          <div className="border-t border-white/10 shrink-0" />

          {shapes.length > 0 ? (
            <>
              <div className="flex items-center justify-between shrink-0">
                <span className="text-xs text-gray-400 font-medium">
                  Полигонов: {shapes.length}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setSelected(
                      selected.size === shapes.length
                        ? new Set()
                        : new Set(shapes.map((s) => s.id)),
                    )
                  }
                  className="text-xs text-indigo-400 hover:text-indigo-300"
                >
                  {selected.size === shapes.length ? 'Снять все' : 'Выбрать все'}
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto rounded-lg border border-white/10 divide-y divide-white/5">
                {shapes.map((s) => {
                  const checked = selected.has(s.id);
                  const alreadyAdded = activeSublocations.some(
                    (loc) => loc.name.toLowerCase() === s.name.toLowerCase(),
                  );
                  return (
                    <div
                      key={s.id}
                      className={`flex flex-col gap-1 px-2 py-1.5 ${checked ? 'bg-indigo-500/10' : 'hover:bg-white/5'}`}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggle(s.id)}
                          className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center ${checked ? 'bg-indigo-500 border-indigo-500' : 'border-gray-600'}`}
                        >
                          {checked && <Check className="w-3 h-3 text-white" />}
                        </button>
                        <input
                          type="text"
                          value={s.name}
                          onChange={(e) => updateMapObject(s.id, { name: e.target.value })}
                          className="flex-1 min-w-0 bg-transparent text-xs text-gray-200 border-b border-transparent focus:border-white/20 focus:outline-none py-0.5"
                          placeholder="Название"
                        />
                        {alreadyAdded && (
                          <span className="text-[9px] px-1 rounded bg-yellow-500/20 text-yellow-400 shrink-0">
                            добавлена
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 pl-6">
                        <input
                          type="color"
                          value={s.color.startsWith('#') ? s.color : '#6366f1'}
                          onChange={(e) => updateMapObject(s.id, { color: e.target.value })}
                          className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
                          title="Цвет полигона"
                        />
                        <button
                          type="button"
                          onClick={() => updateMapObject(s.id, { is_shown: !s.is_shown })}
                          className={`flex items-center gap-1 text-[10px] ${s.is_shown ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-400'}`}
                        >
                          {s.is_shown ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          <span>{s.is_shown ? 'виден' : 'скрыт'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeMapObject(s.id)}
                          className="text-[10px] text-red-400 hover:text-red-300"
                        >
                          удалить
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col gap-1 shrink-0">
                <Button
                  onClick={handleCreate}
                  disabled={selected.size === 0}
                  size="sm"
                  className="w-full gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Добавить как подлокации ({selected.size})
                </Button>
                {success && (
                  <span className="text-xs text-green-400 text-center">{success}</span>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center px-2">
              <span className="text-xs text-gray-600 leading-relaxed">
                Нет полигонов.<br />
                Нарисуйте фигуры на вкладке<br />«Вектор (Excalidraw)» или «Фон (растр)».
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}