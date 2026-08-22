'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Loader2, MapPin, Plus } from 'lucide-react';
import { ScenarioScopedApiService } from '@/app/services/api/scenario_scoped';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/types/element/types';
import type { LocationList, SubLocationFromMapItem } from '@/app/services/types2';
import ExcalidrawDynamic from './location/ExcalidrawDynamic';

type Point = { x: number; y: number };
type ShapeRow = { id: string; name: string; color: string; polygon: Point[]; elType: string };

const SHAPE_TYPES = new Set(['rectangle', 'ellipse', 'diamond', 'freedraw', 'line', 'arrow']);

function isShape(el: ExcalidrawElement) {
  return SHAPE_TYPES.has(el.type) && !el.isDeleted;
}

function elementToPolygon(el: ExcalidrawElement): Point[] {
  // @ts-ignore
  const pts: [number, number][] | undefined = el.points;
  if (pts?.length) {
    return pts.map(([px, py]) => ({ x: (el.x ?? 0) + px, y: (el.y ?? 0) + py }));
  }
  const x = el.x ?? 0;
  const y = el.y ?? 0;
  // @ts-ignore
  const w: number = el.width ?? 0;
  // @ts-ignore
  const h: number = el.height ?? 0;
  if (w && h) return [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
  return [];
}

function elementColor(el: ExcalidrawElement): string {
  // @ts-ignore
  const fill: string = el.backgroundColor ?? '';
  // @ts-ignore
  const stroke: string = el.strokeColor ?? '#6366f1';
  return fill && fill !== 'transparent' && fill !== '#ffffff00' ? fill : stroke;
}

type Props = {
  scenarioId: string;
  locationId: string | null;
  initialExcalidrawData?: any;
  existingChildren: LocationList[];
  onCreated: () => void;
  onExcalidrawChange?: (json: any) => void;
};

export function LocationSublocationsTab({
  scenarioId,
  locationId,
  initialExcalidrawData,
  existingChildren,
  onCreated,
  onExcalidrawChange,
}: Props) {
  const initialDataRef = useRef<any>(null);

  if (!initialDataRef.current) {
    initialDataRef.current = {
      elements: initialExcalidrawData?.elements ?? [],
      appState: initialExcalidrawData?.appState ?? { viewBackgroundColor: '#0f1117' },
    };
  }

  const [elements, setElements] = useState<readonly ExcalidrawElement[]>(
    () => initialDataRef.current.elements ?? []
  );

  const [names, setNames] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const existingNames = useMemo(
    () => new Set(existingChildren.map((l) => l.name.toLowerCase())),
    [existingChildren]
  );

  const shapes = useMemo<ShapeRow[]>(() => {
    const textById: Record<string, string> = {};
    for (const el of elements) {
      if (el.type === 'text' && !el.isDeleted) {
        // @ts-ignore
        const container: string | undefined = el.containerId;
        // @ts-ignore
        if (container) textById[container] = el.text ?? '';
      }
    }

    return elements
      .filter(isShape)
      .map((el) => ({
        id: el.id,
        name: names[el.id] ?? textById[el.id] ?? `${el.type} ${el.id.slice(0, 4)}`,
        color: elementColor(el),
        polygon: elementToPolygon(el),
        elType: el.type,
      }))
      .filter((s) => s.polygon.length >= 2);
  }, [elements, names]);

  const handleChange = useCallback((els: readonly ExcalidrawElement[]) => {
    setElements(els);
  }, []);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleCreate = async () => {
    if (!locationId || selected.size === 0) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    const items: SubLocationFromMapItem[] = shapes
      .filter((s) => selected.has(s.id))
      .map((s) => ({
        name: s.name,
        polygon: s.polygon,
        map_key: s.id,
        color: s.color,
      }));

    try {
      const api = new ScenarioScopedApiService(scenarioId);
      const res = await api.createSublocationsFromMap(locationId, { items });
      setSuccess(`Создано: ${res.created.length}`);
      setSelected(new Set());
      onCreated();
    } catch (e: any) {
      setError(e?.message ?? 'Ошибка');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = useCallback(() => {
    onExcalidrawChange?.({
      elements: Array.from(elements),
      appState: initialDataRef.current.appState,
    });
  }, [elements, onExcalidrawChange]);

  return (
    <div className="flex flex-col gap-3 h-full">
      {existingChildren.length > 0 && (
        <div className="flex flex-wrap gap-1.5 shrink-0">
          {existingChildren.map((loc) => (
            <div
              key={String(loc.id)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-xs text-gray-300"
            >
              <MapPin className="w-3 h-3 text-indigo-400 shrink-0" />
              {loc.name}
            </div>
          ))}
        </div>
      )}

      {!locationId ? (
        <div className="text-sm text-gray-500 italic">
          Сохраните локацию перед созданием подлокаций.
        </div>
      ) : (
        <div className="flex gap-3 min-h-0" style={{ height: 500 }}>
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <div className="flex justify-end shrink-0">
              <Button type="button" size="sm" onClick={handleSave} className="gap-1.5 text-xs">
                <MapPin className="w-3.5 h-3.5" />
                Скопировать карту в локацию
              </Button>
            </div>

            <div className="flex-1 min-w-0 rounded-xl overflow-hidden border border-white/10">
              <ExcalidrawDynamic
                key="sublocations-excalidraw"
                theme="dark"
                initialData={initialDataRef.current}
                onChange={handleChange}
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

          <div className="w-56 shrink-0 flex flex-col gap-2 min-h-0">
            {shapes.length > 0 ? (
              <>
                <div className="flex items-center justify-between shrink-0">
                  <span className="text-xs text-gray-400 font-medium">Фигур: {shapes.length}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSelected(
                        selected.size === shapes.length ? new Set() : new Set(shapes.map((s) => s.id))
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
                    const isDupe = existingNames.has(s.name.toLowerCase());

                    return (
                      <div
                        key={s.id}
                        className={`flex items-center gap-2 px-2 py-1.5 ${
                          checked ? 'bg-indigo-500/10' : 'hover:bg-white/5'
                        }`}
                      >
                        <div
                          className="w-2.5 h-2.5 rounded-sm shrink-0 border border-white/20"
                          style={{ backgroundColor: s.color }}
                        />
                        <button
                          type="button"
                          onClick={() => toggle(s.id)}
                          className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center ${
                            checked ? 'bg-indigo-500 border-indigo-500' : 'border-gray-600'
                          }`}
                        >
                          {checked && <Check className="w-3 h-3 text-white" />}
                        </button>
                        <input
                          type="text"
                          value={s.name}
                          onChange={(e) => setNames((p) => ({ ...p, [s.id]: e.target.value }))}
                          onClick={() => !checked && toggle(s.id)}
                          className="flex-1 min-w-0 bg-transparent text-xs text-gray-200 border-b border-transparent focus:border-white/20 focus:outline-none py-0.5"
                          placeholder="Название"
                        />
                        {isDupe && (
                          <span className="text-[9px] px-1 rounded bg-yellow-500/20 text-yellow-400 shrink-0">
                            дубль
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-col gap-1 shrink-0">
                  <Button onClick={handleCreate} disabled={selected.size === 0 || saving} size="sm" className="w-full gap-1.5">
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Создать ({selected.size})
                  </Button>
                  {success && <span className="text-xs text-green-400 text-center">{success}</span>}
                  {error && <span className="text-xs text-red-400 text-center">{error}</span>}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center px-2">
                <span className="text-xs text-gray-600 leading-relaxed">
                  Нарисуйте фигуры<br />на холсте —<br />они появятся здесь
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}